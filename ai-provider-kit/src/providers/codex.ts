import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

/**
 * Returns the path to the codex binary.
 * Defaults to CODEX_CLI_PATH env var, then "codex" (must be on PATH).
 */
function getCodexBinary(): string {
  return process.env.CODEX_CLI_PATH ?? "codex";
}

/**
 * Returns the model name for Codex CLI.
 * Defaults to CODEX_MODEL → OPENAI_MODEL → "gpt-4o-mini".
 */
export function getCodexModel(): string {
  return process.env.CODEX_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

/**
 * Strips markdown code fences from a string.
 */
function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

/**
 * Invokes the Codex CLI with a prompt and returns the raw text output.
 */
async function runCodex(prompt: string): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-provider-kit-"));
  const outputPath = path.join(tempDir, "last-message.txt");

  const args = [
    "exec",
    "--skip-git-repo-check",
    "--color", "never",
    "-s", "read-only",
    "-C", process.cwd(),
    "-m", getCodexModel(),
    "-o", outputPath,
    "-",
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(getCodexBinary(), args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`Codex CLI exited with code ${code}. ${stderr.trim() || "No stderr output."}`)
        );
        return;
      }
      resolve();
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });

  try {
    return fs.readFileSync(outputPath, "utf-8").trim();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Generates a structured JSON object via Codex CLI.
 */
export async function generateJson<T>(prompt: string): Promise<T> {
  const rawText = await runCodex(
    `${prompt}\n\nReturn valid JSON only. No markdown, no commentary, no code fences.`
  );
  const text = stripMarkdownFences(rawText);

  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]) as T;
    throw new Error(
      `Codex CLI returned non-JSON response. Preview: ${text.slice(0, 400)}…`
    );
  }
}

/**
 * Generates plain text via Codex CLI.
 */
export async function generateText(prompt: string): Promise<string> {
  return runCodex(prompt);
}
