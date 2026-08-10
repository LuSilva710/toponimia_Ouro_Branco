import type {
  ApiTestCase,
  ContractSmokeCase,
  TestResult,
  Evidence,
} from "../types/index.js";
import {
  getToken,
  getDefaultAuthHeader,
  storeToken,
  extractTokenFromResponse,
} from "../config/sessionManager.js";
import { extractVariables, applyVars } from "../config/variableStore.js";

interface ApiResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  durationMs: number;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function executeRequest(
  baseUrl: string,
  endpoint: string,
  method: string,
  headers?: Record<string, string>,
  body?: unknown
): Promise<ApiResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
  const startTime = Date.now();

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };

  const options: RequestInit = {
    method: method.toUpperCase(),
    headers: requestHeaders,
  };

  if (body !== null && body !== undefined && !["GET", "HEAD"].includes(method.toUpperCase())) {
    options.body = JSON.stringify(body);
  }

  const response = await fetchWithTimeout(url, options);
  const durationMs = Date.now() - startTime;

  let responseBody: unknown;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    status: response.status,
    body: responseBody,
    headers: responseHeaders,
    durationMs,
  };
}

function deepContains(actual: unknown, expected: unknown): boolean {
  if (expected === null || expected === undefined) return true;
  if (typeof expected !== "object") {
    return actual === expected;
  }
  if (typeof actual !== "object" || actual === null) return false;

  const expectedObj = expected as Record<string, unknown>;
  const actualObj = actual as Record<string, unknown>;

  for (const key of Object.keys(expectedObj)) {
    if (!deepContains(actualObj[key], expectedObj[key])) {
      return false;
    }
  }
  return true;
}

export async function runApiCase(
  testCase: ApiTestCase,
  baseUrl: string
): Promise<TestResult> {
  const evidence: Evidence = { logs: [] };
  const startTime = Date.now();

  const expectedDesc = `HTTP ${testCase.expectedStatus}${
    testCase.expectedBodyContains
      ? ` with body containing ${JSON.stringify(testCase.expectedBodyContains)}`
      : ""
  }`;

  // Apply variable interpolation if requested
  let resolvedEndpoint = testCase.endpoint;
  let resolvedBody = testCase.body;
  let resolvedHeaders = { ...testCase.headers };

  if (testCase.useVars) {
    const interpolated = applyVars({
      endpoint: testCase.endpoint,
      body: testCase.body,
      headers: testCase.headers,
    });
    resolvedEndpoint = interpolated.endpoint;
    resolvedBody = interpolated.body;
    resolvedHeaders = interpolated.headers ?? {};
    evidence.logs.push(`[vars] Applied variable interpolation to endpoint: ${resolvedEndpoint}`);
  }

  // Build headers, injecting stored auth token if requested
  const headers: Record<string, string> = { ...resolvedHeaders };

  if (testCase.useStoredToken) {
    const tokenKey = testCase.storedTokenKey || "default_bearer";
    const storedToken = getToken(tokenKey);
    if (storedToken) {
      const tokenType = testCase.tokenType || "bearer";
      if (tokenType === "bearer") {
        headers["Authorization"] = `Bearer ${storedToken}`;
        evidence.logs.push(`[auth] Injected Bearer token (key: ${tokenKey})`);
      } else {
        headers["X-API-Key"] = storedToken;
        evidence.logs.push(`[auth] Injected API key (key: ${tokenKey})`);
      }
    } else {
      // Fallback: check for any stored default token
      const defaultHeaders = getDefaultAuthHeader();
      Object.assign(headers, defaultHeaders);
      if (Object.keys(defaultHeaders).length > 0) {
        evidence.logs.push(`[auth] Injected default stored token`);
      } else {
        evidence.logs.push(`[auth] Warning: useStoredToken=true but no token found for "${tokenKey}"`);
      }
    }
  }

  evidence.logs.push(`${testCase.method} ${baseUrl}${resolvedEndpoint}`);
  if (resolvedBody) {
    evidence.requestBody = resolvedBody;
    evidence.logs.push(`Request body: ${JSON.stringify(resolvedBody).slice(0, 200)}`);
  }

  try {
    const response = await executeRequest(
      baseUrl,
      resolvedEndpoint,
      testCase.method,
      headers,
      resolvedBody
    );

    evidence.responseBody = response.body;
    evidence.logs.push(`Response: ${response.status} in ${response.durationMs}ms`);
    evidence.logs.push(
      `Response body: ${JSON.stringify(response.body).slice(0, 300)}`
    );

    // Extract dynamic variables from response body for use in later cases
    if (testCase.extractVars && Object.keys(testCase.extractVars).length > 0) {
      extractVariables(response.body, testCase.extractVars);
      evidence.logs.push(`[vars] Extracted ${Object.keys(testCase.extractVars).length} variable(s): ${Object.keys(testCase.extractVars).join(", ")}`);
    }

    // Auto-extract token from response if requested
    if (testCase.extractTokenToKey) {
      const extracted = extractTokenFromResponse(response.body);
      if (extracted) {
        storeToken(testCase.extractTokenToKey, extracted, "bearer");
        evidence.logs.push(`[auth] Token extracted and stored as "${testCase.extractTokenToKey}"`);
      }
    } else {
      // Always try to auto-store token from login/auth endpoints
      const isAuthEndpoint = /\/(login|auth|signin|token|oauth)/i.test(testCase.endpoint);
      if (isAuthEndpoint && response.status < 300) {
        const extracted = extractTokenFromResponse(response.body);
        if (extracted) {
          storeToken("default_bearer", extracted, "bearer");
          evidence.logs.push(`[auth] Auto-stored auth token from ${testCase.endpoint}`);
        }
      }
    }

    const statusOk = response.status === testCase.expectedStatus;
    const bodyOk =
      !testCase.expectedBodyContains ||
      deepContains(response.body, testCase.expectedBodyContains);

    const actualDesc = `HTTP ${response.status} — ${JSON.stringify(response.body).slice(0, 150)}`;

    if (!statusOk) {
      evidence.logs.push(
        `Status mismatch: expected ${testCase.expectedStatus}, got ${response.status}`
      );
    }
    if (!bodyOk) {
      evidence.logs.push(
        `Body mismatch: expected ${JSON.stringify(testCase.expectedBodyContains)}, got ${JSON.stringify(response.body).slice(0, 200)}`
      );
    }

    return {
      id: testCase.id,
      type: "api",
      name: testCase.name,
      status: statusOk && bodyOk ? "passed" : "failed",
      expected: expectedDesc,
      actual: actualDesc,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    evidence.errorMessage = errorMessage;
    evidence.logs.push(`[REQUEST_ERROR] ${errorMessage}`);

    return {
      id: testCase.id,
      type: "api",
      name: testCase.name,
      status: "error",
      expected: expectedDesc,
      actual: `Error: ${errorMessage}`,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  }
}

export async function runContractSmokeCase(
  testCase: ContractSmokeCase,
  baseUrl: string
): Promise<TestResult> {
  const evidence: Evidence = { logs: [] };
  const startTime = Date.now();

  evidence.logs.push(`Smoke test: ${testCase.method} ${baseUrl}${testCase.endpoint}`);
  evidence.logs.push(`Contract: ${testCase.contractName}`);

  try {
    const response = await executeRequest(baseUrl, testCase.endpoint, testCase.method);

    evidence.responseBody = response.body;
    evidence.logs.push(`Response: ${response.status} in ${response.durationMs}ms`);

    const reachable = response.status < 500;
    const actualDesc = `HTTP ${response.status}`;

    return {
      id: testCase.id,
      type: "contract_smoke",
      name: testCase.name,
      status: reachable ? "passed" : "failed",
      expected: "Endpoint reachable (status < 500)",
      actual: actualDesc,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    evidence.errorMessage = errorMessage;
    evidence.logs.push(`[SMOKE_ERROR] ${errorMessage}`);

    return {
      id: testCase.id,
      type: "contract_smoke",
      name: testCase.name,
      status: "error",
      expected: "Endpoint reachable (status < 500)",
      actual: `Connection error: ${errorMessage}`,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  }
}

export function runFieldValidationCase(
  testCase: import("../types/index.js").FieldValidationCase
): TestResult {
  const startTime = Date.now();
  const evidence: Evidence = { logs: [] };
  const validValue = typeof testCase.validValue === "string" ? testCase.validValue : "";
  const invalidValue =
    typeof testCase.invalidValue === "string" ? testCase.invalidValue : "";

  evidence.logs.push(`Field: ${testCase.field} | Rule: ${testCase.rule}`);
  evidence.logs.push(`Valid value: "${validValue}"`);
  evidence.logs.push(`Invalid value: "${invalidValue}"`);

  let passed = true;
  const expected = `Valid value passes rule "${testCase.rule}", invalid value fails`;

  switch (testCase.rule) {
    case "required": {
      const validPasses = validValue.trim().length > 0;
      const invalidFails = invalidValue.trim().length === 0;
      if (!validPasses) {
        passed = false;
        evidence.logs.push("FAIL: valid value is empty (should be non-empty)");
      }
      if (!invalidFails) {
        passed = false;
        evidence.logs.push("FAIL: invalid value is non-empty (should be empty)");
      }
      break;
    }
    case "minLength": {
      const min = testCase.minLength ?? 1;
      evidence.logs.push(`minLength rule: min=${min}`);
      if (validValue.length < min) {
        passed = false;
        evidence.logs.push(`FAIL: valid value length ${validValue.length} < ${min}`);
      } else {
        evidence.logs.push(`PASS: valid value length ${validValue.length} >= ${min}`);
      }
      if (invalidValue.length >= min) {
        passed = false;
        evidence.logs.push(`FAIL: invalid value length ${invalidValue.length} >= ${min} (should be shorter)`);
      } else {
        evidence.logs.push(`PASS: invalid value length ${invalidValue.length} < ${min}`);
      }
      break;
    }
    case "maxLength": {
      const max = testCase.maxLength ?? 255;
      evidence.logs.push(`maxLength rule: max=${max}`);
      if (validValue.length > max) {
        passed = false;
        evidence.logs.push(`FAIL: valid value length ${validValue.length} > ${max}`);
      } else {
        evidence.logs.push(`PASS: valid value length ${validValue.length} <= ${max}`);
      }
      if (invalidValue.length <= max) {
        passed = false;
        evidence.logs.push(`FAIL: invalid value length ${invalidValue.length} <= ${max} (should be longer)`);
      } else {
        evidence.logs.push(`PASS: invalid value length ${invalidValue.length} > ${max}`);
      }
      break;
    }
    case "pattern": {
      const patternStr = testCase.pattern;
      if (!patternStr) {
        evidence.logs.push("WARN: pattern rule requires a 'pattern' field — skipping");
        return {
          id: testCase.id,
          type: "field_validation",
          name: testCase.name,
          status: "skipped",
          expected,
          actual: "Pattern validation skipped — no pattern field provided",
          durationMs: Date.now() - startTime,
          aiConfidence: testCase.aiConfidence,
          evidence,
        };
      }
      let regex: RegExp;
      try {
        regex = new RegExp(patternStr);
      } catch {
        evidence.logs.push(`FAIL: invalid regex pattern "${patternStr}"`);
        passed = false;
        break;
      }
      evidence.logs.push(`Pattern: ${patternStr}`);
      if (!regex.test(validValue)) {
        passed = false;
        evidence.logs.push(`FAIL: valid value "${validValue}" does not match pattern`);
      } else {
        evidence.logs.push(`PASS: valid value matches pattern`);
      }
      if (regex.test(invalidValue)) {
        passed = false;
        evidence.logs.push(`FAIL: invalid value "${invalidValue}" incorrectly matches pattern`);
      } else {
        evidence.logs.push(`PASS: invalid value correctly rejected by pattern`);
      }
      break;
    }
    case "range": {
      const min = testCase.min ?? 0;
      const max = testCase.max ?? Number.MAX_SAFE_INTEGER;
      evidence.logs.push(`range rule: min=${min} max=${max}`);
      const validNum = parseFloat(validValue);
      const invalidNum = parseFloat(invalidValue);
      if (isNaN(validNum) || validNum < min || validNum > max) {
        passed = false;
        evidence.logs.push(`FAIL: valid value "${validValue}" (${validNum}) is outside range [${min}, ${max}]`);
      } else {
        evidence.logs.push(`PASS: valid value ${validNum} is within range [${min}, ${max}]`);
      }
      if (!isNaN(invalidNum) && invalidNum >= min && invalidNum <= max) {
        passed = false;
        evidence.logs.push(`FAIL: invalid value "${invalidValue}" (${invalidNum}) is inside range (should be outside)`);
      } else {
        evidence.logs.push(`PASS: invalid value is outside range as expected`);
      }
      break;
    }
    default:
      evidence.logs.push(`Rule "${testCase.rule}" — generic non-empty check`);
      passed = validValue.length > 0 && (invalidValue.length === 0 || invalidValue === "invalid");
  }

  return {
    id: testCase.id,
    type: "field_validation",
    name: testCase.name,
    status: passed ? "passed" : "failed",
    expected,
    actual: passed
      ? "Valid value passes, invalid value fails as expected"
      : "Validation rule mismatch detected",
    durationMs: Date.now() - startTime,
    aiConfidence: testCase.aiConfidence,
    evidence,
  };
}

export function runMaskValidationCase(
  testCase: import("../types/index.js").MaskValidationCase
): TestResult {
  const startTime = Date.now();
  const evidence: Evidence = { logs: [] };
  let passed = true;

  evidence.logs.push(`Mask field: ${testCase.field}`);
  evidence.logs.push(`Pattern: ${testCase.maskPattern}`);

  let regex: RegExp;
  try {
    regex = new RegExp(testCase.maskPattern);
  } catch {
    return {
      id: testCase.id,
      type: "mask_validation",
      name: testCase.name,
      status: "error",
      expected: "Valid regex pattern",
      actual: `Invalid regex: ${testCase.maskPattern}`,
      durationMs: Date.now() - startTime,
      aiConfidence: testCase.aiConfidence,
      evidence,
    };
  }

  for (const sample of testCase.validSamples) {
    if (!regex.test(sample)) {
      passed = false;
      evidence.logs.push(`FAIL: Valid sample "${sample}" does not match pattern`);
    } else {
      evidence.logs.push(`PASS: Valid sample "${sample}" matches pattern`);
    }
  }

  for (const sample of testCase.invalidSamples) {
    if (regex.test(sample)) {
      passed = false;
      evidence.logs.push(`FAIL: Invalid sample "${sample}" incorrectly matches pattern`);
    } else {
      evidence.logs.push(`PASS: Invalid sample "${sample}" correctly rejected`);
    }
  }

  return {
    id: testCase.id,
    type: "mask_validation",
    name: testCase.name,
    status: passed ? "passed" : "failed",
    expected: "Valid samples match pattern; invalid samples do not",
    actual: passed
      ? `All ${testCase.validSamples.length} valid + ${testCase.invalidSamples.length} invalid samples passed`
      : "One or more mask assertions failed — see logs",
    durationMs: Date.now() - startTime,
    aiConfidence: testCase.aiConfidence,
    evidence,
  };
}
