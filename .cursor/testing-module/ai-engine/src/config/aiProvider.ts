/**
 * Unified AI provider interface.
 *
 * Set AI_PROVIDER=gemini  → uses Google Gemini (default)
 * Set AI_PROVIDER=openai  → uses OpenAI / Codex CLI models
 *
 * Both providers expose the same generateJson<T>() and generateText() API
 * so all callers are provider-agnostic.
 */

import {
  generateJson as geminiGenerateJson,
  generateText as geminiGenerateText,
} from "./geminiConfig.js";
import {
  generateJsonOpenAI,
  generateTextOpenAI,
} from "./openaiConfig.js";
import {
  generateJsonCodex,
  generateTextCodex,
  getCodexModel,
} from "./codexCliConfig.js";

export type AiProviderName = "gemini" | "openai" | "codex";

export function getActiveProvider(): AiProviderName {
  const raw = (process.env.AI_PROVIDER || "gemini").toLowerCase().trim();
  if (raw === "openai") return "openai";
  if (raw === "codex") return "codex";
  return "gemini";
}

export function getProviderLabel(): string {
  const provider = getActiveProvider();
  if (provider === "codex") {
    return `Codex CLI (${getCodexModel()})`;
  }
  if (provider === "openai") {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    return `OpenAI API (${model})`;
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  return `Google Gemini (${model})`;
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const provider = getActiveProvider();
  if (provider === "codex") {
    return generateJsonCodex<T>(prompt);
  }
  if (provider === "openai") {
    return generateJsonOpenAI<T>(prompt);
  }
  return geminiGenerateJson<T>(prompt);
}

export async function generateText(prompt: string): Promise<string> {
  const provider = getActiveProvider();
  if (provider === "codex") {
    return generateTextCodex(prompt);
  }
  if (provider === "openai") {
    return generateTextOpenAI(prompt);
  }
  return geminiGenerateText(prompt);
}

export function validateProviderConfig(): void {
  const provider = getActiveProvider();

  if (provider === "codex") {
    console.log(`[aiProvider] Active: Codex CLI (model: ${getCodexModel()})`);
    return;
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "AI_PROVIDER=openai requires OPENAI_API_KEY.\n" +
          "Set it in .cursor/testing-module/ai-engine/.env\n" +
          "Get your key at: https://platform.openai.com/api-keys"
      );
    }
    console.log(`[aiProvider] Active: OpenAI API (model: ${process.env.OPENAI_MODEL || "gpt-4o-mini"})`);
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "AI_PROVIDER=gemini requires GEMINI_API_KEY.\n" +
        "Set it in .cursor/testing-module/ai-engine/.env\n" +
        "Get your key at: https://aistudio.google.com/app/apikey"
    );
  }
  console.log(`[aiProvider] Active: Google Gemini (model: ${process.env.GEMINI_MODEL || "gemini-2.0-flash"})`);
}
