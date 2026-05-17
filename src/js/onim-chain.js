/**
 * onim-chain.js
 * Orquestração do Agente ONIM usando LangChain.js
 */
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor } from "langchain/agents";
import { createToolCallingAgent } from "langchain/agents";
import {
  getLangChainModel,
  getGeminiLangChainModelForFallback,
  getGroqLangChainModelForFallback,
  isRateLimitLikeError,
  markLangChainPrimarySuccess,
  markLangChainGeminiFallbackSuccess,
} from './ai-client.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { historicalSearchTool, statsTool, neighborhoodContextTool } from './onim-tools.js';

// Lista de ferramentas disponíveis para o Agente
const tools = [historicalSearchTool, statsTool, neighborhoodContextTool];

async function executarComModelo(model, pergunta, historicoMensagens) {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createToolCallingAgent({
    llm: model,
    tools,
    prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools,
  });

  const result = await executor.invoke({ input: pergunta, chat_history: historicoMensagens });

  let finalOutput = result.output;
  if (finalOutput.includes('{') && finalOutput.includes('}')) {
    finalOutput = finalOutput.replace(/\{.*?\}/gs, '').trim();
  }

  return finalOutput;
}

/**
 * Inicializa e executa o Agente LangChain
 */
export async function executarAgenteONIM(pergunta, historicoMensagens = []) {
  // Limita o histórico para as últimas 4 mensagens para economizar tokens e evitar erro 400/413
  const historicoReduzido = historicoMensagens.slice(-4);
  
  const primaryModel = getLangChainModel();
  const geminiFallback = getGeminiLangChainModelForFallback();
  const groqFallback = getGroqLangChainModelForFallback();

  try {
    const out = await executarComModelo(primaryModel, pergunta, historicoReduzido);
    markLangChainPrimarySuccess();
    return out;
  } catch (error) {
    console.warn('[ONIM] Falha no provedor principal:', error.message);

    // Estratégia de Fallback 1: Se Gemini (primário) falhar, tenta Groq
    if (groqFallback && isRateLimitLikeError(error)) {
      console.warn('[ONIM] Tentando fallback para Groq (Llama)...');
      try {
        const out = await executarComModelo(groqFallback, pergunta, historicoReduzido);
        return out;
      } catch (fErr) {
        console.error('[ONIM] Falha no fallback Groq:', fErr);
        throw fErr;
      }
    }

    // Estratégia de Fallback 2: Se Groq (primário) falhar, tenta Gemini
    if (geminiFallback && isRateLimitLikeError(error)) {
      console.warn('[ONIM] Tentando fallback para Gemini...');
      try {
        const out = await executarComModelo(geminiFallback, pergunta, historicoReduzido);
        markLangChainGeminiFallbackSuccess();
        return out;
      } catch (fErr) {
        console.error('[ONIM] Falha no fallback Gemini:', fErr);
        throw fErr;
      }
    }

    throw error;
  }
}
