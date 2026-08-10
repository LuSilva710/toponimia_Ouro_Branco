import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

function getCodexBinary(): string {
  return process.env.CODEX_CLI_PATH || "codex";
}

export function getCodexModel(): string {
  return process.env.CODEX_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  return trimmed;
}

async function runCodex(prompt: string): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rovis-codex-"));
  const outputPath = path.join(tempDir, "last-message.txt");

  const args = [
    "exec",
    "--skip-git-repo-check",
    "--color",
    "never",
    "-s",
    "read-only",
    "-C",
    process.cwd(),
    "-m",
    getCodexModel(),
    "-o",
    outputPath,
    "-",
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(getCodexBinary(), args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Codex CLI exited with code ${code}. ${stderr.trim() || "No stderr output."}`
          )
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

export async function generateJsonCodex<T>(prompt: string): Promise<T> {
  const rawText = await runCodex(
    `${prompt}\n\nReturn valid JSON only. No markdown, no commentary, no code fences.`
  );
  const text = stripMarkdownFences(rawText);

  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T;
    }
    throw new Error(`Codex CLI returned non-JSON response. Raw text: ${text.slice(0, 400)}...`);
  }
}

export async function generateTextCodex(prompt: string): Promise<string> {
  return runCodex(prompt);
}
