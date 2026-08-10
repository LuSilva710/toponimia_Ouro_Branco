/**
 * variableStore — runtime variables shared across test cases in a single run.
 *
 * Use extractVars on an ApiTestCase to populate values from a response body,
 * then use {{varName}} placeholders in endpoint/body/headers of later cases.
 *
 * Example:
 *   extractVars: { "userId": "data.id", "token": "accessToken" }
 *   → after the case runs, variables["userId"] = response.body.data.id
 *
 * Later case with useVars: true and endpoint: "/api/users/{{userId}}"
 *   → endpoint becomes "/api/users/42"
 */

const variables: Record<string, string> = {};

/** Extract a nested value from an object using dot-notation path */
function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || current === undefined) return undefined;
  return String(current);
}

/** Store extracted variables from a response body */
export function extractVariables(
  responseBody: unknown,
  extractVars: Record<string, string>
): void {
  for (const [varName, path] of Object.entries(extractVars)) {
    const value = getByPath(responseBody, path);
    if (value !== undefined) {
      variables[varName] = value;
      console.log(`[variableStore] Stored var "${varName}" = "${value.slice(0, 60)}"`);
    } else {
      console.log(`[variableStore] Warning: path "${path}" not found in response for var "${varName}"`);
    }
  }
}

/** Replace {{varName}} placeholders in a string */
export function interpolate(value: string): string {
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (variables[name] !== undefined) return variables[name];
    console.log(`[variableStore] Warning: variable "{{${name}}}" used but not defined`);
    return `{{${name}}}`;
  });
}

/** Apply variable interpolation to an entire ApiTestCase's mutable fields */
export function applyVars(testCase: {
  endpoint: string;
  body?: unknown;
  headers?: Record<string, string>;
}): {
  endpoint: string;
  body?: unknown;
  headers?: Record<string, string>;
} {
  const endpoint = interpolate(testCase.endpoint);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(testCase.headers || {})) {
    headers[interpolate(k)] = interpolate(v);
  }

  let body = testCase.body;
  if (body !== null && body !== undefined) {
    try {
      const bodyStr = interpolate(JSON.stringify(body));
      body = JSON.parse(bodyStr);
    } catch {
      // body not JSON-serializable — leave as-is
    }
  }

  return { endpoint, body, headers };
}

/** Get all current variables (for logging) */
export function getAll(): Record<string, string> {
  return { ...variables };
}

/** Clear all variables (call at start of each run) */
export function clearAll(): void {
  for (const key of Object.keys(variables)) {
    delete variables[key];
  }
}
