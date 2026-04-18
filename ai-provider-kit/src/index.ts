/**
 * ai-provider-kit — Unified AI provider facade
 *
 * Selects the active AI backend via the AI_PROVIDER environment variable:
 *   AI_PROVIDER=gemini  → Google Gemini (default)
 *   AI_PROVIDER=openai  → OpenAI API
 *   AI_PROVIDER=codex   → Codex CLI (local, no API key required)
 *
 * All providers expose the same generateJson<T>() and generateText() API,
 * so callers are 100% provider-agnostic.
 */

import {
  generateJson as geminiJson,
  generateText as geminiText,
} from "./providers/gemini.js";
import {
  generateJson as openaiJson,
  generateText as openaiText,
  getOpenAIModel,
} from "./providers/openai.js";
import {
  generateJson as codexJson,
  generateText as codexText,
  getCodexModel,
} from "./providers/codex.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiProviderName = "gemini" | "openai" | "codex";

// ─── Provider selection ───────────────────────────────────────────────────────

/**
 * Returns the currently active provider name, resolved from AI_PROVIDER env var.
 * Defaults to "gemini" if not set or unrecognised.
 */
export function getActiveProvider(): AiProviderName {
  const raw = (process.env.AI_PROVIDER ?? "gemini").toLowerCase().trim();
  if (raw === "openai") return "openai";
  if (raw === "codex") return "codex";
  return "gemini";
}

/**
 * Returns a human-readable label for the currently active provider and model.
 */
export function getProviderLabel(): string {
  const provider = getActiveProvider();
  if (provider === "codex") return `Codex CLI (${getCodexModel()})`;
  if (provider === "openai") return `OpenAI API (${getOpenAIModel()})`;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  return `Google Gemini (${model})`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates that the required environment variables are present for the
 * active provider. Throws a descriptive error if anything is missing.
 * Call this once at application startup.
 */
export function validateProviderConfig(): void {
  const provider = getActiveProvider();

  if (provider === "codex") {
    console.log(`[ai-provider-kit] Active: ${getProviderLabel()}`);
    return; // Codex CLI; no API key needed
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "AI_PROVIDER=openai requires OPENAI_API_KEY.\n" +
          "Set it in your .env file.\n" +
          "Get your key at: https://platform.openai.com/api-keys"
      );
    }
    console.log(`[ai-provider-kit] Active: ${getProviderLabel()}`);
    return;
  }

  // gemini (default)
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "AI_PROVIDER=gemini requires GEMINI_API_KEY.\n" +
        "Set it in your .env file.\n" +
        "Get your key at: https://aistudio.google.com/app/apikey"
    );
  }
  console.log(`[ai-provider-kit] Active: ${getProviderLabel()}`);
}

// ─── Unified API ─────────────────────────────────────────────────────────────

/**
 * Generates a structured JSON response from the active AI provider.
 *
 * @template T   Expected shape of the returned object.
 * @param prompt  The prompt to send to the model.
 * @returns       Parsed JSON of type T.
 */
export async function generateJson<T>(prompt: string): Promise<T> {
  const provider = getActiveProvider();
  if (provider === "codex") return codexJson<T>(prompt);
  if (provider === "openai") return openaiJson<T>(prompt);
  return geminiJson<T>(prompt);
}

/**
 * Generates a plain-text response from the active AI provider.
 *
 * @param prompt  The prompt to send to the model.
 * @returns       The model's text response as a trimmed string.
 */
export async function generateText(prompt: string): Promise<string> {
  const provider = getActiveProvider();
  if (provider === "codex") return codexText(prompt);
  if (provider === "openai") return openaiText(prompt);
  return geminiText(prompt);
}
