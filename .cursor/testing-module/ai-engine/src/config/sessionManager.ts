/**
 * Session Manager
 *
 * Persists auth state (JWT tokens, cookies, localStorage, browser storageState)
 * across test runs so authenticated tests don't need to re-login every time.
 *
 * Storage location: .cursor/testing-module/reports/session/
 */

import fs from "fs";
import path from "path";

const SESSION_DIR = path.resolve(
  ".cursor/testing-module/reports/session"
);
const TOKEN_STORE_FILE = path.join(SESSION_DIR, "token-store.json");
const BROWSER_STATE_FILE = path.join(SESSION_DIR, "browser-state.json");

export interface StoredToken {
  key: string;
  value: string;
  type: "bearer" | "cookie" | "api-key" | "custom";
  storedAt: string;
  expiresAt?: string;
}

export interface SessionStore {
  tokens: Record<string, StoredToken>;
  lastLogin?: string;
  loginUrl?: string;
}

function ensureDir(): void {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function loadStore(): SessionStore {
  ensureDir();
  if (!fs.existsSync(TOKEN_STORE_FILE)) {
    return { tokens: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(TOKEN_STORE_FILE, "utf-8")) as SessionStore;
  } catch {
    return { tokens: {} };
  }
}

function saveStore(store: SessionStore): void {
  ensureDir();
  fs.writeFileSync(TOKEN_STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function storeToken(
  key: string,
  value: string,
  type: StoredToken["type"] = "bearer",
  expiresAt?: string
): void {
  const store = loadStore();
  store.tokens[key] = {
    key,
    value,
    type,
    storedAt: new Date().toISOString(),
    expiresAt,
  };
  saveStore(store);
  console.log(`[sessionManager] Token stored: ${key} (type: ${type})`);
}

export function getToken(key: string): string | null {
  const store = loadStore();
  const entry = store.tokens[key];
  if (!entry) return null;

  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    console.warn(`[sessionManager] Token "${key}" has expired — clearing`);
    delete store.tokens[key];
    saveStore(store);
    return null;
  }

  return entry.value;
}

export function getDefaultAuthHeader(): Record<string, string> {
  const bearerKey = "default_bearer";
  const apiKey = "default_api_key";

  const bearer = getToken(bearerKey);
  if (bearer) {
    return { Authorization: `Bearer ${bearer}` };
  }

  const api = getToken(apiKey);
  if (api) {
    return { "X-API-Key": api };
  }

  return {};
}

export function registerLogin(loginUrl: string): void {
  const store = loadStore();
  store.lastLogin = new Date().toISOString();
  store.loginUrl = loginUrl;
  saveStore(store);
}

export function clearSession(): void {
  ensureDir();
  if (fs.existsSync(TOKEN_STORE_FILE)) {
    fs.writeFileSync(TOKEN_STORE_FILE, JSON.stringify({ tokens: {} }, null, 2), "utf-8");
  }
  if (fs.existsSync(BROWSER_STATE_FILE)) {
    fs.unlinkSync(BROWSER_STATE_FILE);
  }
  console.log("[sessionManager] Session cleared");
}

export function hasBrowserState(): boolean {
  return fs.existsSync(BROWSER_STATE_FILE);
}

export function getBrowserStatePath(): string {
  ensureDir();
  return BROWSER_STATE_FILE;
}

export function getSessionSummary(): string {
  const store = loadStore();
  const keys = Object.keys(store.tokens);
  if (keys.length === 0) return "No tokens stored";
  return `Stored tokens: ${keys.join(", ")} | Last login: ${store.lastLogin || "never"}`;
}

export function extractTokenFromResponse(
  responseBody: unknown,
  possibleFields = ["token", "accessToken", "access_token", "jwt", "authToken", "id_token"]
): string | null {
  if (typeof responseBody !== "object" || responseBody === null) return null;

  const body = responseBody as Record<string, unknown>;

  for (const field of possibleFields) {
    if (typeof body[field] === "string" && (body[field] as string).length > 10) {
      return body[field] as string;
    }
    // nested: { data: { token: "..." } }
    if (typeof body["data"] === "object" && body["data"] !== null) {
      const nested = body["data"] as Record<string, unknown>;
      if (typeof nested[field] === "string") {
        return nested[field] as string;
      }
    }
  }
  return null;
}
