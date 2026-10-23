// ============================================================
// onim-chat — proxy do agente ONIM (Supabase Edge Function)
//
// As chaves de LLM nunca vão para o bundle do site.
// Entrada:  POST { pergunta: string, historico?: { role: 'user'|'bot', text: string }[] }
//           POST { teste: true }  — só admin (JWT): testa o provedor e devolve o erro real
// Saída:    200 { html } | 200 { ok, ... } (teste) | 4xx/5xx { error, code }
//
// Configuração (a primeira que existir vence):
//   1. Painel admin → aba "Inteligência Artificial" (tabela configuracao_ia, migration 10)
//   2. Secrets da função (supabase secrets set ...), usados como fallback:
//      GEMINI_API_KEY, GEMINI_MODEL, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL,
//      AI_PROVIDER (gemini | openai), ALLOWED_ORIGINS
// Só secrets: RATE_LIMIT_PER_MINUTE (6), RATE_LIMIT_PER_DAY (60), RATE_LIMIT_SALT.
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetados pela plataforma.
// ============================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { SYSTEM_PROMPT } from './prompt.ts'
import { TOOL_DEFINITIONS, runTool } from './tools.ts'

const MAX_PERGUNTA = 500
const MAX_HISTORICO = 4
const MAX_HISTORICO_TEXTO = 1500
const MAX_TOOL_STEPS = 4
const CONFIG_TTL_MS = 60_000
/** Alias do Google que acompanha o Flash mais recente (evita 404 quando um modelo é aposentado). */
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

const env = (name: string, fallback = '') => (Deno.env.get(name) ?? fallback).trim()

function serviceClient(): SupabaseClient<any> | null {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return key ? createClient(env('SUPABASE_URL'), key, { auth: { persistSession: false } }) : null
}

// ─── Configuração (banco > secrets) ─────────────────────────────────────────

interface Config {
  provider: 'gemini' | 'openai'
  geminiKey: string
  geminiModel: string
  openaiKey: string
  openaiBaseUrl: string
  openaiModel: string
  allowedOrigins: string[]
}

let cachedConfig: { value: Config; expires: number } | null = null

const splitOrigins = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)

async function loadConfig(): Promise<Config> {
  if (cachedConfig && cachedConfig.expires > Date.now()) return cachedConfig.value

  let row: Record<string, string | null> = {}
  const admin = serviceClient()
  if (admin) {
    const { data, error } = await admin.from('configuracao_ia').select('*').eq('id', 1).maybeSingle()
    if (error) console.warn('[onim-chat] configuracao_ia indisponível, usando secrets:', error.message)
    else if (data) row = data
  }

  const pick = (dbValue: string | null | undefined, envName: string, fallback = '') =>
    (dbValue ?? '').trim() || env(envName, fallback)

  const value: Config = {
    provider: pick(row.provider, 'AI_PROVIDER', 'gemini') === 'openai' ? 'openai' : 'gemini',
    geminiKey: pick(row.gemini_api_key, 'GEMINI_API_KEY'),
    geminiModel: pick(row.gemini_model, 'GEMINI_MODEL', DEFAULT_GEMINI_MODEL).replace(/^models\//, ''),
    openaiKey: pick(row.openai_api_key, 'OPENAI_API_KEY'),
    openaiBaseUrl: pick(row.openai_base_url, 'OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiModel: pick(row.openai_model, 'OPENAI_MODEL', 'gpt-4o-mini'),
    allowedOrigins: splitOrigins(pick(row.origens_permitidas, 'ALLOWED_ORIGINS')),
  }
  cachedConfig = { value, expires: Date.now() + CONFIG_TTL_MS }
  return value
}

// ─── HTTP / CORS ─────────────────────────────────────────────────────────────

function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  // Sem origens configuradas, libera qualquer origem (útil só em dev)
  const allowed = !allowedOrigins.length
    ? '*'
    : origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// ─── Providers (todos via API OpenAI-compatible) ─────────────────────────────

interface Provider {
  label: string
  baseUrl: string
  apiKey: string
  model: string
}

/** Primário primeiro; o outro entra só em erro de cota/limite. */
function providerChain(config: Config): Provider[] {
  const gemini: Provider | null = config.geminiKey
    ? {
        label: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: config.geminiKey,
        model: config.geminiModel,
      }
    : null
  const openai: Provider | null = config.openaiKey
    ? { label: 'openai', baseUrl: config.openaiBaseUrl, apiKey: config.openaiKey, model: config.openaiModel }
    : null
  const ordered = config.provider === 'openai' ? [openai, gemini] : [gemini, openai]
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

async function chatCompletion(provider: Provider, messages: unknown[], withTools = true) {
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
      max_tokens: withTools ? 1024 : 20,
      messages,
      ...(withTools ? { tools: TOOL_DEFINITIONS } : {}),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.error?.message ?? (Array.isArray(data) ? data[0]?.error?.message : '') ?? response.statusText
    throw new ProviderError(`${provider.label} ${response.status}: ${String(detail).slice(0, 300)}`, response.status)
  }
  const message = data?.choices?.[0]?.message
  if (!message) throw new ProviderError(`${provider.label}: resposta vazia`, 502)
  return message
}

/** Laço de tool calling: o modelo chama ferramentas até produzir a resposta final. */
async function runAgent(provider: Provider, baseMessages: unknown[], db: SupabaseClient<any>, geminiKey?: string) {
  const messages = [...baseMessages]

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

// ─── Modo teste (painel admin) ──────────────────────────────────────────────

async function isAdminRequest(req: Request): Promise<boolean> {
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return false
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await userClient.rpc('is_admin')
  return !error && data === true
}

/** Chamada mínima sem ferramentas a cada provedor configurado; devolve o erro real para o admin. */
async function testProviders(config: Config) {
  const providers = providerChain(config)
  if (!providers.length) {
    return { ok: false, resultados: [], detalhe: 'Nenhuma chave configurada (Gemini nem OpenAI-compatível).' }
  }
  const resultados = []
  for (const provider of providers) {
    try {
      await chatCompletion(provider, [{ role: 'user', content: 'Responda apenas: ok' }], false)
      resultados.push({ provider: provider.label, model: provider.model, ok: true })
    } catch (err) {
      resultados.push({ provider: provider.label, model: provider.model, ok: false, erro: (err as Error).message })
    }
  }
  return { ok: resultados.some((r) => r.ok), resultados }
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
  const admin = serviceClient()
  if (!admin) return true
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
  const config = await loadConfig()
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(origin, config.allowedOrigins), 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin, config.allowedOrigins) })
  if (req.method !== 'POST') return json({ error: 'Método não permitido', code: 'method' }, 405)
  if (config.allowedOrigins.length && origin && !config.allowedOrigins.includes(origin)) {
    return json({ error: 'Origem não permitida', code: 'origin' }, 403)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido', code: 'bad_request' }, 400)
  }

  if (body?.teste === true) {
    if (!(await isAdminRequest(req))) return json({ error: 'Apenas administradores', code: 'forbidden' }, 403)
    cachedConfig = null // o admin acabou de salvar: lê a configuração nova
    return json(await testProviders(await loadConfig()), 200)
  }

  const pergunta = String(body?.pergunta ?? '').trim()
  if (!pergunta) return json({ error: 'Pergunta vazia', code: 'bad_request' }, 400)
  if (pergunta.length > MAX_PERGUNTA) {
    return json({ error: `Pergunta muito longa (máx. ${MAX_PERGUNTA} caracteres)`, code: 'too_long' }, 400)
  }

  if (!(await consumeQuota(req))) {
    return json({ error: 'Muitas perguntas seguidas. Aguarde um pouco.', code: 'rate_limited' }, 429)
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
  const providers = providerChain(config)
  if (!providers.length) {
    console.error('[onim-chat] nenhum provider configurado (painel admin ou secrets)')
    return json({ error: 'Serviço de IA não configurado', code: 'not_configured' }, 503)
  }

  let lastError: unknown
  for (const provider of providers) {
    try {
      const html = await runAgent(provider, baseMessages, db, config.geminiKey || undefined)
      return json({ html, provider: provider.label }, 200)
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
  )
})
