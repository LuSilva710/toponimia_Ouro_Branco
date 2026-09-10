/**
 * ai-client.js — Browser-native adapter do ai-provider-kit
 *
 * Estratégia de resiliência:
 *   1. Tenta o provider primário configurado (VITE_AI_PROVIDER)
 *   2. Se falhar com erro recuperável, faz fallback para OpenRouter
 *   3. No OpenRouter, tenta modelos gratuitos em sequência até um responder
 *   4. Agente LangChain: se o provedor principal retornar limite de cota (429/TPD),
 *      repete com Gemini quando VITE_GEMINI_API_KEY estiver definida
 *
 * Providers suportados (via VITE_AI_PROVIDER):
 *   "gemini"     → Google Gemini REST API  (primário recomendado)
 *   "openai"     → OpenAI API
 *   "openrouter" → OpenRouter direto (sem fallback Gemini)
 *
 * Uso:
 *   import { generateText, generateJson, getProviderLabel } from './ai-client.js'
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

// ─── Config ──────────────────────────────────────────────────────────────────

const AI_PROVIDER  = import.meta.env.VITE_AI_PROVIDER    ?? 'gemini';
const GEMINI_KEY   = import.meta.env.VITE_GEMINI_API_KEY  ?? '';
const GEMINI_MODEL_RAW = String(import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-flash-latest').trim() || 'gemini-2.0-flash';

/** Limpa o prefixo 'models/' se presente */
function _sanitizeGeminiChatModelId(id) {
  return id; // Mantém o caminho completo (ex: models/...) para evitar 404
}

const GEMINI_MODEL = _sanitizeGeminiChatModelId(GEMINI_MODEL_RAW);
// OpenRouter: VITE_OPENROUTER_API_KEY é alias de VITE_OPENAI_API_KEY
const OPENAI_KEY   = import.meta.env.VITE_OPENAI_API_KEY
  || import.meta.env.VITE_OPENROUTER_API_KEY
  || '';
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

/** Última execução do agente LangChain completou via Gemini após limite do provedor principal */
let _agentUsedGeminiAfterPrimaryRateLimit = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trunca um bloco de contexto RAG para evitar exceder o limite de tokens do provider.
 * @param {string} contexto - Texto de contexto gerado pelo RAG
 * @param {number} maxChars - Limite máximo de caracteres (default 6000 ≈ ~1500 tokens)
 */
export function truncateContext(contexto, maxChars = 6000) {
  if (!contexto || contexto.length <= maxChars) return contexto;
  const truncado = contexto.slice(0, maxChars);
  // Corta na última quebra de linha completa para não truncar no meio de um campo
  const ultimaLinha = truncado.lastIndexOf('\n');
  return (ultimaLinha > maxChars * 0.8 ? truncado.slice(0, ultimaLinha) : truncado)
    + '\n[contexto truncado — limite de tokens]';
}

export function getProviderLabel() {
  if (_fallbackActive) return `Ollama (fallback local)`;

  let base;
  if (AI_PROVIDER === 'openrouter') base = `OpenRouter`;
  else if (AI_PROVIDER === 'openai') {
    if (OPENAI_BASE.includes('x.ai')) base = `xAI Grok (${import.meta.env.VITE_OPENAI_MODEL ?? 'grok-3-mini'})`;
    else if (OPENAI_BASE.includes('groq.com')) base = `Groq (${import.meta.env.VITE_OPENAI_MODEL ?? 'llama-3.1-8b-instant'})`;
    else if (OPENAI_BASE.includes('openrouter.ai')) base = `OpenRouter (${import.meta.env.VITE_OPENAI_MODEL ?? ''})`;
    else base = `OpenAI (${import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini'})`;
  } else {
    base = `Google Gemini (${GEMINI_MODEL})`;
  }

  if (_agentUsedGeminiAfterPrimaryRateLimit && AI_PROVIDER !== 'gemini') {
    return `${base} → Gemini (${GEMINI_MODEL}, fallback por limite/cota)`;
  }
  return base;
}

/** Erro de limite de uso (429, TPD, etc.) — candidato a fallback Gemini no agente */
export function isRateLimitLikeError(err) {
  const name = err?.name ?? '';
  const msg = String(err?.message ?? '');
  return (
    name === 'RateLimitError'
    || msg.includes('429')
    || msg.includes('413')
    || /too large/i.test(msg)
    || /rate limit/i.test(msg)
    || /tokens per day/i.test(msg)
    || /tokens per minute/i.test(msg)
    || /\bTPD\b/.test(msg)
    || /\bTPM\b/.test(msg)
    || /RESOURCE_EXHAUSTED/i.test(msg)
  );
}

export function markLangChainPrimarySuccess() {
  _agentUsedGeminiAfterPrimaryRateLimit = false;
}

export function markLangChainGeminiFallbackSuccess() {
  _agentUsedGeminiAfterPrimaryRateLimit = true;
}

/**
 * Modelo Gemini para o AgentExecutor quando o provedor principal (ex.: Groq) retorna limite de cota.
 */
export function getGeminiLangChainModelForFallback(temperature = 0.2) {
  if (AI_PROVIDER === 'gemini' || !GEMINI_KEY) return null;
  return _createGeminiChatModel(temperature);
}

/**
 * Modelo Groq/OpenAI para o AgentExecutor quando o provedor principal (Gemini) retorna limite de cota.
 */
export function getGroqLangChainModelForFallback(temperature = 0.2) {
  if (AI_PROVIDER !== 'gemini' || !OPENAI_KEY) return null;
  return new ChatOpenAI({
    openAIApiKey: OPENAI_KEY,
    configuration: {
      baseURL: OPENAI_BASE,
    },
    modelName: import.meta.env.VITE_OPENAI_MODEL || "llama-3.1-8b-instant",
    temperature: temperature,
    maxTokens: 800,
  });
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
    // Mensagem cobre VITE_OPENAI_API_KEY e alias VITE_OPENROUTER_API_KEY
    throw new Error(
      '[ai-client] Configure VITE_OPENAI_API_KEY ou VITE_OPENROUTER_API_KEY no .env.'
    );
  }
  if (AI_PROVIDER === 'openai' && OPENAI_BASE.includes('groq.com') && !GEMINI_KEY) {
    console.warn(
      '[ai-client] VITE_GEMINI_API_KEY ausente — quando a cota Groq esgotar, o agente não poderá alternar para Gemini.'
    );
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
      max_tokens: 800,
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
    || msg.includes('404') || msg.includes('503') || msg.includes('500')
    || msg.includes('max tokens') || msg.includes('token limit')
    || msg.includes('exceeded') || msg.includes('context_length');
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

function _createGeminiChatModel(temperature = 0.2) {
  return new ChatGoogleGenerativeAI({
    apiKey: GEMINI_KEY,
    model: GEMINI_MODEL,
    temperature,
    maxOutputTokens: 2048,
  });
}

/**
 * Retorna uma instância de ChatModel do LangChain baseada no provider ativo.
 */
export function getLangChainModel(temperature = 0.2) {
  if (AI_PROVIDER === 'gemini') {
    return _createGeminiChatModel(temperature);
  }

  // OpenAI, OpenRouter, Groq, Ollama (OpenAI compatible)
  return new ChatOpenAI({
    openAIApiKey: OPENAI_KEY,
    configuration: {
      baseURL: OPENAI_BASE,
      defaultHeaders: {
        "HTTP-Referer": window.location.origin,
        "X-Title": "Toponímia Urbana de Ouro Branco",
      }
    },
    modelName: import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini",
    temperature: temperature,
    maxTokens: 800,
  });
}
