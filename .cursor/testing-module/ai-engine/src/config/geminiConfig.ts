import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set. " +
          "Copy .env.example to .env and fill in your API key from https://aistudio.google.com/app/apikey"
      );
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

export function getGeminiModel(modelName?: string): GenerativeModel {
  const client = getGeminiClient();
  const model = modelName || process.env.GEMINI_MODEL || "gemini-2.0-flash";
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

export async function generateJson<T>(prompt: string): Promise<T> {
  const model = getGeminiModel();
  const fullPrompt = `${prompt}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation text. Just the raw JSON object or array.`;

  const result = await model.generateContent(fullPrompt);
  const text = result.response.text().trim();

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T;
    }
    throw new Error(
      `Gemini returned non-JSON response. Raw text: ${text.slice(0, 200)}...`
    );
  }
}

export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
