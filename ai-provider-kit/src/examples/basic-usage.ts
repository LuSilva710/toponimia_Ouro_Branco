/**
 * Basic usage example for ai-provider-kit.
 *
 * Run with:
 *   npm run example:gemini
 *   npm run example:openai
 *   npm run example:codex
 */

import "dotenv/config";
import {
  validateProviderConfig,
  getProviderLabel,
  generateText,
  generateJson,
} from "../index.js";

interface Joke {
  setup: string;
  punchline: string;
}

async function main() {
  // 1. Validate env vars — throws early if something is missing
  validateProviderConfig();
  console.log(`\nUsing provider: ${getProviderLabel()}\n`);

  // ── Example 1: Plain text generation ─────────────────────────────────────
  const poem = await generateText(
    "Write a single haiku about software development."
  );
  console.log("─── Text output ───────────────────────────────");
  console.log(poem);
  console.log();

  // ── Example 2: Structured JSON generation ────────────────────────────────
  const joke = await generateJson<Joke>(
    'Generate a short programming joke as JSON with fields "setup" and "punchline".'
  );
  console.log("─── JSON output ───────────────────────────────");
  console.log(JSON.stringify(joke, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
