import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Returns a singleton OpenAI client.
 * Requires OPENAI_API_KEY in the environment.
 */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set.\n" +
          "Set it in .env or via: $env:OPENAI_API_KEY = 'sk-...'\n" +
          "Get your key at: https://platform.openai.com/api-keys"
      );
    }
    const baseURL = process.env.OPENAI_BASE_URL; // undefined = padrão OpenAI
    _client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }
  return _client;
}

/**
 * Returns the model name to use.
 * Defaults to OPENAI_MODEL env var, then "gpt-4o-mini".
 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

/**
 * Generates a structured JSON object via OpenAI chat completions.
 * Uses response_format: json_object for guaranteed JSON output.
 */
export async function generateJson<T>(prompt: string): Promise<T> {
  const client = getOpenAIClient();
  const model = getOpenAIModel();

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a helpful AI assistant. Always respond with valid JSON only. No markdown, no explanation.",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";

  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]) as T;
    throw new Error(
      `OpenAI returned non-JSON response. Preview: ${text.slice(0, 200)}…`
    );
  }
}

/**
 * Generates plain text via OpenAI chat completions.
 */
export async function generateText(prompt: string): Promise<string> {
  const client = getOpenAIClient();
  const model = getOpenAIModel();

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: "You are a helpful AI assistant.",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
