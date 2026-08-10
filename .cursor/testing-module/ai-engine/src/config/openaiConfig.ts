import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. " +
          "Set it in .env or via: $env:OPENAI_API_KEY = 'sk-...'\n" +
          "Get your key at: https://platform.openai.com/api-keys"
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export async function generateJsonOpenAI<T>(prompt: string): Promise<T> {
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
        content:
          "You are a senior QA engineer. Always respond with valid JSON only. No markdown, no explanation.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";

  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T;
    }
    throw new Error(
      `OpenAI returned non-JSON response. Raw text: ${text.slice(0, 200)}...`
    );
  }
}

export async function generateTextOpenAI(prompt: string): Promise<string> {
  const client = getOpenAIClient();
  const model = getOpenAIModel();

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: "You are a senior QA engineer and software quality analyst.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
