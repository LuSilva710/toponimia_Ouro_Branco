// ============================================================
// onim-chat — proxy do agente ONIM (Supabase Edge Function)
//
// As chaves de LLM ficam só aqui (secrets do Supabase), nunca no bundle do site.
// Entrada:  POST { pergunta: string, historico?: { role: 'user'|'bot', text: string }[] }
// Saída:    200 { html } | 4xx/5xx { error, code }
//
// Secrets (supabase secrets set ...):
//   GEMINI_API_KEY, GEMINI_MODEL                        — provider Gemini + embeddings
//   OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL       — Groq / OpenRouter / OpenAI (opcional)
//   AI_PROVIDER = gemini | openai                       — primário (default gemini)
//   ALLOWED_ORIGINS = https://usuario.github.io,http://localhost:5173
//   RATE_LIMIT_PER_MINUTE (default 6), RATE_LIMIT_PER_DAY (default 60), RATE_LIMIT_SALT
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetados pela plataforma.
// ============================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { SYSTEM_PROMPT } from './prompt.ts'
import { TOOL_DEFINITIONS, runTool } from './tools.ts'

const MAX_PERGUNTA = 500
const MAX_HISTORICO = 4
const MAX_HISTORICO_TEXTO = 1500
const MAX_TOOL_STEPS = 4

const env = (name: string, fallback = '') => (Deno.env.get(name) ?? fallback).trim()

const ALLOWED_ORIGINS = env('ALLOWED_ORIGINS')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  // Sem ALLOWED_ORIGINS configurado, libera qualquer origem (útil só em dev)
  const allowed = !ALLOWED_ORIGINS.length
    ? '*'
    : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

// ─── Providers (todos via API OpenAI-compatible) ─────────────────────────────

interface Provider {
  label: string
  baseUrl: string
  apiKey: string
  model: string
}

function geminiProvider(): Provider | null {
  const apiKey = env('GEMINI_API_KEY')
  if (!apiKey) return null
  return {
    label: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey,
    model: env('GEMINI_MODEL', 'gemini-2.0-flash').replace(/^models\//, ''),
  }
}

function openaiProvider(): Provider | null {
  const apiKey = env('OPENAI_API_KEY')
  if (!apiKey) return null
  return {
    label: 'openai',
    baseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey,
    model: env('OPENAI_MODEL', 'gpt-4o-mini'),
  }
}

/** Primário primeiro; o outro entra só em erro de cota/limite. */
function providerChain(): Provider[] {
  const gemini = geminiProvider()
  const openai = openaiProvider()
  const ordered = env('AI_PROVIDER', 'gemini') === 'openai' ? [openai, gemini] : [gemini, openai]
  return ordered.filter((p): p is Provider => p !== null)
}

class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
  get isRateLimit() {
    return this.status === 429 || this.status === 413 || /rate limit|quota|RESOURCE_EXHAUSTED|tokens per/i.test(this.message)
  }
}

async function chatCompletion(provider: Provider, messages: unknown[]) {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      'X-Title': 'Toponímia Urbana de Ouro Branco',
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.2,
      max_tokens: 1024,
      messages,
      tools: TOOL_DEFINITIONS,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.error?.message ?? (Array.isArray(data) ? data[0]?.error?.message : '') ?? response.statusText
    throw new ProviderError(`${provider.label} ${response.status}: ${String(detail).slice(0, 200)}`, response.status)
  }
  const message = data?.choices?.[0]?.message
  if (!message) throw new ProviderError(`${provider.label}: resposta vazia`, 502)
  return message
}

/** Laço de tool calling: o modelo chama ferramentas até produzir a resposta final. */
async function runAgent(provider: Provider, baseMessages: unknown[], db: SupabaseClient<any>) {
  const messages = [...baseMessages]
  const geminiKey = env('GEMINI_API_KEY') || undefined

  for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
    const message = await chatCompletion(provider, messages)
    const toolCalls = message.tool_calls ?? []

    if (!toolCalls.length || step === MAX_TOOL_STEPS) {
      const text = String(message.content ?? '').trim()
      // Remove restos de JSON de tool call que alguns modelos vazam no texto
      return text.includes('{') && text.includes('}') ? text.replace(/\{.*?\}/gs, '').trim() : text
    }

    messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: toolCalls })
    for (const call of toolCalls) {
      const result = await runTool(call.function?.name, call.function?.arguments ?? '{}', db, geminiKey)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result.slice(0, 6000) })
    }
  }
  return ''
}

// ─── Rate limit (tabela onim_rate_limit, migration 08) ──────────────────────

async function clientBucket(req: Request): Promise<string> {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconhecido'
  const bytes = new TextEncoder().encode(`${env('RATE_LIMIT_SALT', 'onim')}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function consumeQuota(req: Request): Promise<boolean> {
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) return true
  const admin = createClient(env('SUPABASE_URL'), serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.rpc('onim_consume_quota', {
    p_bucket: await clientBucket(req),
    p_limit_minute: Number(env('RATE_LIMIT_PER_MINUTE', '6')),
    p_limit_day: Number(env('RATE_LIMIT_PER_DAY', '60')),
  })
  if (error) {
    // Falha aberta: um erro no limitador não derruba o chatbot
    console.error('[onim-chat] rate limit indisponível:', error.message)
    return true
  }
  return data === true
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método não permitido', code: 'method' }, 405, origin)
  if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Origem não permitida', code: 'origin' }, 403, origin)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido', code: 'bad_request' }, 400, origin)
  }

  const pergunta = String(body?.pergunta ?? '').trim()
  if (!pergunta) return json({ error: 'Pergunta vazia', code: 'bad_request' }, 400, origin)
  if (pergunta.length > MAX_PERGUNTA) {
    return json({ error: `Pergunta muito longa (máx. ${MAX_PERGUNTA} caracteres)`, code: 'too_long' }, 400, origin)
  }

  if (!(await consumeQuota(req))) {
    return json({ error: 'Muitas perguntas seguidas. Aguarde um pouco.', code: 'rate_limited' }, 429, origin)
  }

  const historico = (Array.isArray(body?.historico) ? body.historico : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'bot') && typeof m?.text === 'string')
    .slice(-MAX_HISTORICO)
    .map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text.slice(0, MAX_HISTORICO_TEXTO),
    }))

  const baseMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...historico, { role: 'user', content: pergunta }]

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const providers = providerChain()
  if (!providers.length) {
    console.error('[onim-chat] nenhum provider configurado (GEMINI_API_KEY / OPENAI_API_KEY)')
    return json({ error: 'Serviço de IA não configurado', code: 'not_configured' }, 503, origin)
  }

  let lastError: unknown
  for (const provider of providers) {
    try {
      const html = await runAgent(provider, baseMessages, db)
      return json({ html, provider: provider.label }, 200, origin)
    } catch (err) {
      lastError = err
      console.warn(`[onim-chat] ${provider.label} falhou:`, (err as Error).message)
      if (!(err instanceof ProviderError && err.isRateLimit)) break
    }
  }

  const rateLimited = lastError instanceof ProviderError && lastError.isRateLimit
  return json(
    rateLimited
      ? { error: 'Limite de uso do serviço de IA atingido. Tente novamente mais tarde.', code: 'provider_rate_limited' }
      : { error: 'Falha ao consultar o serviço de IA.', code: 'provider_error' },
    rateLimited ? 429 : 502,
    origin,
  )
})
