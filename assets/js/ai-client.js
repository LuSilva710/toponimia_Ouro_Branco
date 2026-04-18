/**
 * ai-client.js — Browser-native adapter do ai-provider-kit
 *
 * Estratégia de resiliência:
 *   1. Tenta o provider primário configurado (VITE_AI_PROVIDER)
 *   2. Se falhar com erro recuperável, faz fallback para OpenRouter
 *   3. No OpenRouter, tenta modelos gratuitos em sequência até um responder
 *
 * Providers suportados (via VITE_AI_PROVIDER):
 *   "gemini"     → Google Gemini REST API  (primário recomendado)
 *   "openai"     → OpenAI API
 *   "openrouter" → OpenRouter direto (sem fallback Gemini)
 *
 * Uso:
 *   import { generateText, generateJson, getProviderLabel } from './ai-client.js'
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const AI_PROVIDER  = import.meta.env.VITE_AI_PROVIDER    ?? 'gemini';
const GEMINI_KEY   = import.meta.env.VITE_GEMINI_API_KEY  ?? '';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL    ?? 'gemini-2.0-flash';
const OPENAI_KEY   = import.meta.env.VITE_OPENAI_API_KEY  ?? '';
const OPENAI_BASE  = import.meta.env.VITE_OPENAI_BASE_URL ?? 'https://openrouter.ai/api/v1';
const OLLAMA_BASE  = import.meta.env.VITE_OLLAMA_URL       ?? 'http://localhost:11434';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL     ?? 'qwen2.5:3b';

/** Modelos OpenRouter tentados em ordem — fallback automático se um falhar */
const OPENROUTER_MODELS = [
  'google/gemma-3-12b-it:free',
  'deepseek/deepseek-r1:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen3-8b:free',
];

let _fallbackActive = false; // true quando está usando OpenRouter como fallback

// ─── Public API ───────────────────────────────────────────────────────────────

export function getProviderLabel() {
  if (_fallbackActive) return `Ollama (fallback local)`;
  if (AI_PROVIDER === 'openrouter') return `OpenRouter`;
  if (AI_PROVIDER === 'openai') {
    if (OPENAI_BASE.includes('x.ai'))          return `xAI Grok (${import.meta.env.VITE_OPENAI_MODEL ?? 'grok-3-mini'})`;
    if (OPENAI_BASE.includes('groq.com'))      return `Groq (${import.meta.env.VITE_OPENAI_MODEL ?? 'llama-3.1-8b-instant'})`;
    if (OPENAI_BASE.includes('openrouter.ai')) return `OpenRouter (${import.meta.env.VITE_OPENAI_MODEL ?? ''})`;
    return `OpenAI (${import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini'})`;
  }
  return `Google Gemini (${GEMINI_MODEL})`;
}

export function validateConfig() {
  if (AI_PROVIDER === 'gemini' && !GEMINI_KEY) {
    throw new Error(
      '[ai-client] VITE_GEMINI_API_KEY não configurada.\n' +
      'Adicione ao .env: VITE_GEMINI_API_KEY=sua_chave\n' +
      'Obtenha em: https://aistudio.google.com/app/apikey'
    );
  }
  if ((AI_PROVIDER === 'openai' || AI_PROVIDER === 'openrouter') && !OPENAI_KEY) {
    throw new Error(`[ai-client] VITE_OPENAI_API_KEY não configurada.`);
  }
  console.log(`[ai-client] Provider ativo: ${getProviderLabel()}`);
}

/**
 * Gera uma resposta em texto puro.
 * Tenta o provider primário; se falhar, usa OpenRouter como fallback.
 */
export async function generateText(systemPrompt, userPrompt, temperature = 0.2) {
  // Provider primário = OpenRouter direto (sem fallback adicional)
  if (AI_PROVIDER === 'openrouter') {
    return _openrouterWithFallback(systemPrompt, userPrompt, temperature);
  }

  // Provider primário = OpenAI (sem fallback)
  if (AI_PROVIDER === 'openai') {
    return _openaiGenerateText(systemPrompt, userPrompt, temperature, import.meta.env.VITE_OPENAI_MODEL);
  }

  // Provider primário = Gemini → fallback: Ollama local → OpenRouter
  try {
    _fallbackActive = false;
    return await _geminiGenerateText(systemPrompt, userPrompt, temperature);
  } catch (err) {
    if (!_isRecoverableError(err)) throw err;
    console.warn(`[ai-client] Gemini falhou (${_extractStatus(err)}), tentando Ollama local...`);
  }

  // Fallback 1: Ollama local (sem custo, sem cota)
  try {
    _fallbackActive = true;
    const result = await _ollamaGenerateText(systemPrompt, userPrompt, temperature);
    console.log('[ai-client] Ollama local respondeu com sucesso.');
    return result;
  } catch {
    console.warn('[ai-client] Ollama não disponível, tentando OpenRouter...');
  }

  // Fallback 2: OpenRouter (modelos gratuitos em sequência)
  if (!OPENAI_KEY) throw new Error('[ai-client] Sem fallback disponível. Configure VITE_OPENAI_API_KEY.');
  return _openrouterWithFallback(systemPrompt, userPrompt, temperature);
}

export async function generateJson(systemPrompt, userPrompt) {
  const jsonInstruction = '\n\nIMPORTANTE: Responda APENAS com JSON válido. Sem markdown, sem explicação.';
  const text = await generateText(systemPrompt + jsonInstruction, userPrompt, 0.1);
  return _parseJson(text);
}

// ─── OpenRouter com fallback entre modelos ────────────────────────────────────

async function _openrouterWithFallback(systemPrompt, userPrompt, temperature) {
  let lastError;
  for (const model of OPENROUTER_MODELS) {
    try {
      const result = await _openaiGenerateText(systemPrompt, userPrompt, temperature, model);
      console.log(`[ai-client] OpenRouter respondeu com: ${model}`);
      return result;
    } catch (err) {
      const msg = err.message ?? '';
      // 400 "Provider returned error" e 404 "No endpoints" são recuperáveis no OpenRouter
      const isRecuperavel = msg.includes('404') || msg.includes('No endpoints')
        || msg.includes('529') || msg.includes('503') || msg.includes('overload')
        || (msg.includes('400') && msg.includes('Provider returned error'));

      if (!isRecuperavel) throw err;
      console.warn(`[ai-client] "${model}" indisponível, tentando próximo...`);
      lastError = err;
    }
  }
  throw new Error(`[ai-client] Todos os modelos OpenRouter falharam. Último erro: ${lastError?.message?.slice(0, 120)}`);
}

// ─── Ollama (local) ──────────────────────────────────────────────────────────

async function _ollamaGenerateText(systemPrompt, userPrompt, temperature) {
  const response = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`[ai-client/ollama] Erro ${response.status}: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('[ai-client/ollama] Resposta vazia.');
  return text.trim();
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function _geminiGenerateText(systemPrompt, userPrompt, temperature) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: 2048, topK: 40, topP: 0.95 }
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`[ai-client/gemini] Erro ${response.status}: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('[ai-client/gemini] Resposta vazia.');
  return text.trim();
}

// ─── OpenAI-compatible (OpenRouter / OpenAI) ─────────────────────────────────

async function _openaiGenerateText(systemPrompt, userPrompt, temperature, model) {
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Toponímia Urbana de Ouro Branco',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`[ai-client/openai] Erro ${response.status}: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('[ai-client/openai] Resposta vazia.');
  return text.trim();
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _isRecoverableError(err) {
  const msg = err.message ?? '';
  return msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
    || msg.includes('404') || msg.includes('503') || msg.includes('500');
}

function _extractStatus(err) {
  const match = (err.message ?? '').match(/Erro (\d+)/);
  return match ? `HTTP ${match[1]}` : 'erro desconhecido';
}

function _parseJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]);
    throw new Error(`[ai-client] JSON inválido. Preview: ${raw.slice(0, 200)}`);
  }
}
