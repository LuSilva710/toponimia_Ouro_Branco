import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

/**
 * Returns a singleton Gemini client.
 * Requires GEMINI_API_KEY in the environment.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set.\n" +
          "Copy .env.example to .env and fill in your key from https://aistudio.google.com/app/apikey"
      );
    }
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

/**
 * Returns a configured GenerativeModel instance.
 * Model defaults to GEMINI_MODEL env var, then "gemini-2.0-flash".
 */
export function getGeminiModel(modelName?: string): GenerativeModel {
  const client = getGeminiClient();
  const model = modelName ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  return client.getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });
}

/**
 * Generates a structured JSON object via Gemini.
 * Automatically strips markdown code fences from the response.
 */
export async function generateJson<T>(prompt: string): Promise<T> {
  const model = getGeminiModel();
  const fullPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation. Just the raw JSON.`;

  const result = await model.generateContent(fullPrompt);
  const raw = result.response.text().trim();

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]) as T;
    throw new Error(
      `Gemini returned non-JSON response. Preview: ${raw.slice(0, 200)}…`
    );
  }
}

/**
 * Generates plain text via Gemini.
 */
export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
