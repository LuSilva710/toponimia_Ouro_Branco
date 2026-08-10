import { chromium, Browser, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import type { BrowserTestCase, TestResult, Evidence, BrowserFlowStep } from "../types/index.js";
import {
  storeToken,
  getToken,
  hasBrowserState,
  getBrowserStatePath,
  registerLogin,
  extractTokenFromResponse,
  getSessionSummary,
} from "../config/sessionManager.js";

const SCREENSHOT_DIR = path.resolve(
  ".cursor/testing-module/reports/playwright-artifacts/screenshots"
);
const TRACE_DIR = path.resolve(
  ".cursor/testing-module/reports/playwright-artifacts/traces"
);

let browser: Browser | null = null;

function isHeadedMode(): boolean {
  // Browser flows always run headed so the user can see what's being tested.
  // Set HEADED=0 to explicitly opt-out (e.g. in CI environments).
  return process.env.HEADED !== "0" && process.env.HEADED !== "false";
}

function getSlowMo(): number {
  const val = parseInt(process.env.SLOW_MO || "0", 10);
  return isNaN(val) ? 0 : val;
}

function getStepDelay(): number {
  const val = parseInt(process.env.STEP_DELAY || "0", 10);
  return isNaN(val) ? 0 : val;
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const headed = isHeadedMode();
    const slowMo = getSlowMo();
    if (headed) {
      console.log(`[playwright] Headed mode ON — browser will be visible (slowMo: ${slowMo}ms)`);
    }
    browser = await chromium.launch({
      headless: !headed,
      slowMo,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function runBrowserCase(
  testCase: BrowserTestCase,
  baseUrl: string
): Promise<TestResult> {
  const startTime = Date.now();
  const evidence: Evidence = { logs: [] };
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(TRACE_DIR, { recursive: true });

  try {
    const browserInstance = await getBrowser();

    // Restore saved browser session (cookies + localStorage) if it exists
    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      baseURL: baseUrl,
      ignoreHTTPSErrors: true,
    };

    const browserStatePath = getBrowserStatePath();
    if (hasBrowserState()) {
      contextOptions.storageState = browserStatePath;
      evidence.logs.push(`[session] Restored browser state from: ${browserStatePath}`);
      evidence.logs.push(`[session] ${getSessionSummary()}`);
    }

    if (isHeadedMode()) {
      contextOptions.viewport = { width: 1280, height: 800 };
    }
    context = await browserInstance.newContext(contextOptions);
    await context.tracing.start({ screenshots: true, snapshots: true });
    page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        evidence.logs.push(`[console.error] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      evidence.logs.push(`[page.error] ${err.message}`);
    });

    evidence.logs.push(`Starting browser flow: ${testCase.name}`);

    const stepDelay = getStepDelay();
    for (const step of testCase.steps) {
      await executeStep(page, context, step, baseUrl, evidence);
      if (stepDelay > 0) {
        await page.waitForTimeout(stepDelay);
      }
    }

    // Save session after successful flow (in case a login happened)
    await context.storageState({ path: browserStatePath });

    const traceFileName = `${testCase.id}-${Date.now()}.zip`;
    const tracePath = path.join(TRACE_DIR, traceFileName);
    await context.tracing.stop({ path: tracePath });
    evidence.tracePath = tracePath;
    evidence.logs.push("Browser flow completed successfully");

    return {
      id: testCase.id,
      type: "browser_flow",
      name: testCase.name,
      status: "passed",
      expected: "All flow steps complete without errors",
      actual: `${testCase.steps.length} steps executed successfully`,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    evidence.logs.push(`[FAILED] ${errorMessage}`);
    evidence.errorMessage = errorMessage;

    if (page) {
      try {
        const screenshotFileName = `${testCase.id}-failure-${Date.now()}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFileName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        evidence.screenshotPath = screenshotPath;
        evidence.logs.push(`Screenshot saved: ${screenshotPath}`);
      } catch {
        evidence.logs.push("Failed to capture screenshot");
      }
    }

    if (context) {
      try {
        const traceFileName = `${testCase.id}-failure-${Date.now()}.zip`;
        const tracePath = path.join(TRACE_DIR, traceFileName);
        await context.tracing.stop({ path: tracePath });
        evidence.tracePath = tracePath;
      } catch {
        evidence.logs.push("Failed to save trace");
      }
    }

    return {
      id: testCase.id,
      type: "browser_flow",
      name: testCase.name,
      status: "failed",
      expected: "All flow steps complete without errors",
      actual: errorMessage,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

async function executeStep(
  page: Page,
  context: BrowserContext,
  step: BrowserFlowStep,
  baseUrl: string,
  evidence: Evidence
): Promise<void> {
  const timeout = step.timeout || 15000;

  switch (step.action) {
    case "navigate": {
      const url = step.url
        ? step.url.startsWith("http") ? step.url : `${baseUrl}${step.url}`
        : baseUrl;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      evidence.logs.push(`Navigated to: ${url}`);
      break;
    }

    case "click": {
      if (!step.selector) throw new Error("click requires selector");
      await page.locator(step.selector).first().click({ timeout });
      evidence.logs.push(`Clicked: ${step.selector}`);
      break;
    }

    case "fill": {
      if (!step.selector) throw new Error("fill requires selector");
      if (step.value === undefined) throw new Error("fill requires value");
      await page.locator(step.selector).first().fill(step.value, { timeout });
      evidence.logs.push(`Filled "${step.selector}"`);
      break;
    }

    case "login": {
      const username = step.username || process.env.TEST_USERNAME || "";
      const password = step.password || process.env.TEST_PASSWORD || "";
      const loginUrl = step.url || process.env.TEST_AUTH_URL || "";

      if (!username || !password) {
        throw new Error(
          "login step requires TEST_USERNAME and TEST_PASSWORD in .env (or step.username/password)"
        );
      }

      if (loginUrl) {
        const fullUrl = loginUrl.startsWith("http") ? loginUrl : `${baseUrl}${loginUrl}`;
        await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout });
        evidence.logs.push(`Navigated to login: ${fullUrl}`);
      }

      const usernameSelector = step.usernameSelector || process.env.TEST_USERNAME_SELECTOR ||
        "input[type=email], input[name=email], input[name=username], #email, #username";
      const passwordSelector = step.passwordSelector || process.env.TEST_PASSWORD_SELECTOR ||
        "input[type=password], input[name=password], #password";
      const submitSelector = step.submitSelector || process.env.TEST_SUBMIT_SELECTOR ||
        "button[type=submit], input[type=submit], button:has-text('Login'), button:has-text('Entrar')";

      await page.locator(usernameSelector).first().fill(username, { timeout });
      evidence.logs.push(`Filled username (${usernameSelector})`);

      await page.locator(passwordSelector).first().fill(password, { timeout });
      evidence.logs.push("Filled password");

      // Listen for auth response before clicking submit
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("login") || res.url().includes("auth") || res.url().includes("signin"),
        { timeout: timeout + 5000 }
      ).catch(() => null);

      await page.locator(submitSelector).first().click({ timeout });
      evidence.logs.push("Clicked submit");

      const authResponse = await responsePromise;
      if (authResponse) {
        try {
          const body = await authResponse.json() as unknown;
          const token = extractTokenFromResponse(body);
          if (token) {
            storeToken("default_bearer", token, "bearer");
            evidence.logs.push(`[auth] JWT token extracted and stored (key: default_bearer)`);
          }
        } catch {
          // Response might not be JSON — that's ok
        }
      }

      // Also try to extract token from localStorage after login
      await page.waitForTimeout(1000);
      const lsToken = await page.evaluate(() => {
        const keys = ["token", "accessToken", "access_token", "jwt", "authToken", "id_token"];
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val && val.length > 10) return val;
        }
        return null;
      });
      if (lsToken) {
        storeToken("default_bearer", lsToken, "bearer");
        evidence.logs.push(`[auth] Token extracted from localStorage and stored`);
      }

      // Save full browser state
      const browserStatePath = getBrowserStatePath();
      await context.storageState({ path: browserStatePath });
      registerLogin(loginUrl || baseUrl);
      evidence.logs.push(`[auth] Browser state saved to: ${browserStatePath}`);
      break;
    }

    case "store_token": {
      const tokenField = step.tokenField || "token";
      const storageKey = step.storageKey || "default_bearer";

      const value = await page.evaluate((field) => {
        return localStorage.getItem(field) ||
          sessionStorage.getItem(field) ||
          (document.cookie.split(";").find((c) => c.trim().startsWith(field + "=")) || "").split("=")[1] || "";
      }, tokenField);

      if (value) {
        storeToken(storageKey, value.trim(), "bearer");
        evidence.logs.push(`[auth] Token stored: ${storageKey} = ${value.slice(0, 20)}...`);
      } else {
        evidence.logs.push(`[auth] Warning: token field "${tokenField}" not found in storage`);
      }
      break;
    }

    case "use_token": {
      const tokenKey = step.storageKey || "default_bearer";
      const token = getToken(tokenKey);
      if (token) {
        await context.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
        evidence.logs.push(`[auth] Injected Bearer token into context headers (key: ${tokenKey})`);
      } else {
        evidence.logs.push(`[auth] Warning: no token found for key "${tokenKey}"`);
      }
      break;
    }

    case "assert_authenticated": {
      const indicator = step.selector ||
        process.env.TEST_AUTH_INDICATOR ||
        "[data-user], .user-menu, .avatar, #profile, .logout-btn, button:has-text('Sair'), button:has-text('Logout')";
      try {
        await page.locator(indicator).first().waitFor({ state: "visible", timeout });
        evidence.logs.push(`[auth] Authenticated indicator visible: ${indicator}`);
      } catch {
        throw new Error(`Not authenticated — indicator not found: ${indicator}`);
      }
      break;
    }

    case "read_localStorage": {
      const key = step.localStorageKey || step.value || "";
      const val = await page.evaluate((k) => localStorage.getItem(k), key);
      if (step.storageKey && val) {
        storeToken(step.storageKey, val, "custom");
      }
      evidence.logs.push(`[localStorage] "${key}" = ${val ? val.slice(0, 80) : "null"}`);
      if (step.value && val && !val.includes(step.value)) {
        throw new Error(`localStorage["${key}"] expected to contain "${step.value}", got "${val}"`);
      }
      break;
    }

    case "write_localStorage": {
      const key = step.localStorageKey || "";
      const val = step.value || "";
      await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: val });
      evidence.logs.push(`[localStorage] Set "${key}"`);
      break;
    }

    case "get_cookie": {
      const cookieName = step.cookieName || step.value || "";
      const cookies = await context.cookies();
      const cookie = cookies.find((c) => c.name === cookieName);
      if (step.storageKey && cookie) {
        storeToken(step.storageKey, cookie.value, "cookie");
      }
      evidence.logs.push(`[cookie] "${cookieName}" = ${cookie ? cookie.value.slice(0, 40) : "not found"}`);
      break;
    }

    case "save_session": {
      const browserStatePath = getBrowserStatePath();
      await context.storageState({ path: browserStatePath });
      evidence.logs.push(`[session] Browser state saved: ${browserStatePath}`);
      break;
    }

    case "restore_session": {
      evidence.logs.push(`[session] Session restore is handled at context creation — already active`);
      break;
    }

    case "assert_text": {
      if (!step.selector) throw new Error("assert_text requires selector");
      const text = await page.locator(step.selector).first().innerText({ timeout });
      if (step.value && !text.includes(step.value)) {
        throw new Error(`Expected "${step.value}" in "${step.selector}". Got: "${text}"`);
      }
      evidence.logs.push(`Asserted text in "${step.selector}": OK`);
      break;
    }

    case "assert_visible": {
      if (!step.selector) throw new Error("assert_visible requires selector");
      await page.locator(step.selector).first().waitFor({ state: "visible", timeout });
      evidence.logs.push(`Asserted visible: "${step.selector}"`);
      break;
    }

    case "assert_url": {
      const currentUrl = page.url();
      const expected = step.value || "";
      if (!currentUrl.includes(expected)) {
        throw new Error(`Expected URL to contain "${expected}". Got: "${currentUrl}"`);
      }
      evidence.logs.push(`Asserted URL contains "${expected}": OK`);
      break;
    }

    case "double_click": {
      if (!step.selector) throw new Error("double_click requires selector");
      await page.locator(step.selector).first().dblclick({ timeout });
      evidence.logs.push(`Double-clicked: ${step.selector}`);
      break;
    }

    case "clear": {
      if (!step.selector) throw new Error("clear requires selector");
      await page.locator(step.selector).first().clear({ timeout });
      evidence.logs.push(`Cleared: ${step.selector}`);
      break;
    }

    case "type_slow": {
      if (!step.selector) throw new Error("type_slow requires selector");
      if (step.value === undefined) throw new Error("type_slow requires value");
      await page.locator(step.selector).first().clear({ timeout });
      await page.locator(step.selector).first().pressSequentially(step.value, { delay: 80 });
      evidence.logs.push(`Typed slowly into "${step.selector}": ${step.value}`);
      break;
    }

    case "select": {
      if (!step.selector) throw new Error("select requires selector");
      const locator = page.locator(step.selector).first();
      if (step.optionValue !== undefined) {
        await locator.selectOption({ value: step.optionValue }, { timeout });
        evidence.logs.push(`Selected option value="${step.optionValue}" in "${step.selector}"`);
      } else if (step.optionText !== undefined) {
        await locator.selectOption({ label: step.optionText }, { timeout });
        evidence.logs.push(`Selected option label="${step.optionText}" in "${step.selector}"`);
      } else if (step.optionIndex !== undefined) {
        await locator.selectOption({ index: step.optionIndex }, { timeout });
        evidence.logs.push(`Selected option index=${step.optionIndex} in "${step.selector}"`);
      } else if (step.value !== undefined) {
        // fallback: try value first, then label
        try {
          await locator.selectOption({ value: step.value }, { timeout });
        } catch {
          await locator.selectOption({ label: step.value }, { timeout });
        }
        evidence.logs.push(`Selected "${step.value}" in "${step.selector}"`);
      } else {
        throw new Error("select requires optionValue, optionText, optionIndex, or value");
      }
      break;
    }

    case "hover": {
      if (!step.selector) throw new Error("hover requires selector");
      await page.locator(step.selector).first().hover({ timeout });
      evidence.logs.push(`Hovered: ${step.selector}`);
      break;
    }

    case "press_key": {
      const key = step.value || "Enter";
      if (step.selector) {
        await page.locator(step.selector).first().press(key, { timeout });
        evidence.logs.push(`Pressed "${key}" on "${step.selector}"`);
      } else {
        await page.keyboard.press(key);
        evidence.logs.push(`Pressed "${key}" (global keyboard)`);
      }
      break;
    }

    case "scroll_to": {
      if (!step.selector) throw new Error("scroll_to requires selector");
      await page.locator(step.selector).first().scrollIntoViewIfNeeded({ timeout });
      evidence.logs.push(`Scrolled to: ${step.selector}`);
      break;
    }

    case "screenshot": {
      const label = step.value || `step-${Date.now()}`;
      const screenshotFileName = `${label.replace(/[^a-z0-9\-_]/gi, "-")}-${Date.now()}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFileName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      evidence.screenshotPath = screenshotPath;
      evidence.logs.push(`Screenshot saved: ${screenshotPath}`);
      break;
    }

    case "assert_not_visible": {
      if (!step.selector) throw new Error("assert_not_visible requires selector");
      await page.locator(step.selector).first().waitFor({ state: "hidden", timeout });
      evidence.logs.push(`Asserted not visible: "${step.selector}"`);
      break;
    }

    case "assert_count": {
      if (!step.selector) throw new Error("assert_count requires selector");
      const expected = step.count ?? 0;
      const count = await page.locator(step.selector).count();
      if (count !== expected) {
        throw new Error(`Expected ${expected} elements matching "${step.selector}", found ${count}`);
      }
      evidence.logs.push(`Asserted count ${expected} for "${step.selector}": OK`);
      break;
    }

    case "assert_value": {
      if (!step.selector) throw new Error("assert_value requires selector");
      const inputValue = await page.locator(step.selector).first().inputValue({ timeout });
      if (step.value !== undefined && !inputValue.includes(step.value)) {
        throw new Error(`Expected value to contain "${step.value}" in "${step.selector}". Got: "${inputValue}"`);
      }
      evidence.logs.push(`Asserted value in "${step.selector}": OK`);
      break;
    }

    case "wait_for_response": {
      const pattern = step.value || step.url || "";
      if (!pattern) throw new Error("wait_for_response requires value (URL pattern)");
      await page.waitForResponse(
        (res) => res.url().includes(pattern),
        { timeout: step.timeout || 15000 }
      );
      evidence.logs.push(`Waited for response matching: "${pattern}"`);
      break;
    }

    case "wait": {
      const waitMs = step.timeout || 1000;
      await page.waitForTimeout(waitMs);
      evidence.logs.push(`Waited ${waitMs}ms`);
      break;
    }

    default:
      evidence.logs.push(`Unknown step action "${step.action}" — skipped`);
  }
}
