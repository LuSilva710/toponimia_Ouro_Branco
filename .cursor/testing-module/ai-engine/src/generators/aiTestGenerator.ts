import { generateJson, getActiveProvider, getProviderLabel } from "../config/aiProvider.js";
import { summarizeContract } from "./contractReader.js";
import type {
  GenerationInput,
  TestCase,
  ApiTestCase,
  BrowserTestCase,
  FieldValidationCase,
  MaskValidationCase,
  ContractSmokeCase,
  LoadedContract,
  FeatureDescription,
} from "../types/index.js";

interface GeneratedCaseBatch {
  cases: TestCase[];
}

export async function generateTestCases(input: GenerationInput): Promise<TestCase[]> {
  console.log(`[aiTestGenerator] AI provider: ${getProviderLabel()}`);
  const allCases: TestCase[] = [];

  for (const contract of input.contracts) {
    console.log(`[aiTestGenerator] Generating cases for contract: ${contract.name}`);
    const cases = await generateCasesForContract(contract, input);
    allCases.push(...cases);
  }

  if (input.features && input.features.length > 0) {
    for (const feature of input.features) {
      console.log(`[aiTestGenerator] Generating cases for feature: ${feature.title}`);
      const cases = await generateCasesForFeature(feature, input);
      allCases.push(...cases);
    }
  }

  if (allCases.length === 0) {
    console.log("[aiTestGenerator] No contracts or features found. Generating default smoke tests.");
    allCases.push(...generateDefaultSmokeCases(input.targetBaseUrl));
  }

  console.log(`[aiTestGenerator] Total cases generated: ${allCases.length}`);
  return allCases;
}

async function generateCasesForContract(
  contract: LoadedContract,
  input: GenerationInput
): Promise<TestCase[]> {
  const summary = summarizeContract(contract);
  const max = input.maxCasesPerContract;

  const hasAuth = process.env.TEST_USERNAME && process.env.TEST_PASSWORD;
  const authNote = hasAuth
    ? `AUTH AVAILABLE: TEST_USERNAME and TEST_PASSWORD are configured.
- Generate a login flow FIRST (browser_flow with "login" action or api POST /login)
- Use "useStoredToken": true on subsequent API cases that require authentication
- Use "extractTokenToKey": "default_bearer" on the login API case`
    : `AUTH: No TEST_USERNAME/TEST_PASSWORD configured. Generate unauthenticated tests only.`;

  const prompt = `You are a world-class QA engineer. Analyze the following API contract and generate comprehensive, production-grade test cases.

CONTRACT SUMMARY:
${summary}

TARGET API BASE URL: ${input.targetBaseUrl}
TARGET BROWSER URL: ${input.targetBrowserUrl}

${authNote}

Generate up to ${max} test cases covering ALL of the following:
1. Authentication flow (login + token storage) — if auth is available
2. Happy path with authenticated requests
3. Error cases (invalid inputs, wrong auth, expected 4xx responses)
4. Edge cases (boundary values, empty payloads, special characters)
5. Contract smoke test (verify endpoint exists)
6. Field/mask validations for form fields
7. Browser E2E flows (including forms with <select> dropdowns when applicable)

AVAILABLE BROWSER FLOW ACTIONS (use ALL that make sense for each screen):
- navigate: go to a URL
- click: click any element
- double_click: double-click (tables, editable cells)
- fill: type into text/email/password inputs
- type_slow: type char-by-char for masked inputs (CPF, phone, CEP, date)
- clear: clear an input before filling
- select: choose an option from a <select> dropdown — use optionValue, optionText, or optionIndex
- hover: hover to reveal tooltips/submenus
- press_key: press keyboard key (Enter, Tab, Escape, ArrowDown, etc.)
- scroll_to: scroll element into view
- screenshot: capture evidence mid-flow
- assert_text: verify element text contains value
- assert_visible: verify element is visible
- assert_not_visible: verify element is hidden/absent
- assert_url: verify current URL contains string
- assert_count: verify number of elements matching selector
- assert_value: verify input/select current value
- wait_for_response: wait for a network call matching URL pattern
- login: smart login action (fills credentials, submits, saves session)
- assert_authenticated: verify authenticated state
- save_session: persist cookies + storage

Return a JSON object with this exact structure:
{
  "cases": [
    {
      "type": "api",
      "id": "unique-kebab-case-id",
      "name": "Login and get token",
      "description": "POST /login with credentials, extract JWT token",
      "endpoint": "/login",
      "method": "POST",
      "headers": { "Content-Type": "application/json" },
      "body": { "email": "${process.env.TEST_USERNAME || "user@example.com"}", "password": "***" },
      "expectedStatus": 200,
      "expectedBodyContains": {},
      "extractTokenToKey": "default_bearer",
      "aiConfidence": 0.95
    },
    {
      "type": "api",
      "id": "unique-kebab-case-id",
      "name": "Get user profile (authenticated)",
      "description": "GET /me using stored token, extract user id for later",
      "endpoint": "/me",
      "method": "GET",
      "headers": {},
      "body": null,
      "expectedStatus": 200,
      "useStoredToken": true,
      "storedTokenKey": "default_bearer",
      "extractVars": { "userId": "data.id", "userEmail": "data.email" },
      "expectedBodyContains": {},
      "aiConfidence": 0.9
    },
    {
      "type": "api",
      "id": "unique-kebab-case-id",
      "name": "Get specific user by extracted id",
      "description": "GET /users/:id using userId variable from previous case",
      "endpoint": "/api/users/{{userId}}",
      "method": "GET",
      "headers": {},
      "body": null,
      "expectedStatus": 200,
      "useStoredToken": true,
      "useVars": true,
      "expectedBodyContains": {},
      "aiConfidence": 0.85
    },
    {
      "type": "browser_flow",
      "id": "unique-kebab-case-id",
      "name": "Login via browser and verify dashboard",
      "description": "Open app, login with credentials, verify authenticated state",
      "steps": [
        { "action": "navigate", "url": "/" },
        { "action": "login", "url": "/login", "storageKey": "default_bearer" },
        { "action": "assert_authenticated" },
        { "action": "screenshot", "value": "after-login" },
        { "action": "save_session" }
      ],
      "aiConfidence": 0.9
    },
    {
      "type": "browser_flow",
      "id": "unique-kebab-case-id",
      "name": "Fill form with select dropdown",
      "description": "Fill a form that has a <select> field, submit and verify success",
      "steps": [
        { "action": "navigate", "url": "/form-page" },
        { "action": "fill", "selector": "input[name=name]", "value": "João Silva" },
        { "action": "type_slow", "selector": "input[name=cpf]", "value": "123.456.789-10" },
        { "action": "select", "selector": "select[name=estado]", "optionText": "São Paulo" },
        { "action": "select", "selector": "select[name=categoria]", "optionValue": "admin" },
        { "action": "screenshot", "value": "form-filled" },
        { "action": "click", "selector": "button[type=submit]" },
        { "action": "wait_for_response", "value": "/api/" },
        { "action": "assert_visible", "selector": ".success-message, [data-success]" }
      ],
      "aiConfidence": 0.85
    },
    {
      "type": "field_validation",
      "id": "unique-kebab-case-id",
      "name": "Email field required validation",
      "field": "email",
      "rule": "required",
      "validValue": "user@example.com",
      "invalidValue": "",
      "aiConfidence": 0.95
    },
    {
      "type": "field_validation",
      "id": "unique-kebab-case-id",
      "name": "Password minLength validation",
      "field": "password",
      "rule": "minLength",
      "minLength": 8,
      "validValue": "Senha@123",
      "invalidValue": "abc",
      "aiConfidence": 0.95
    },
    {
      "type": "field_validation",
      "id": "unique-kebab-case-id",
      "name": "Email pattern validation",
      "field": "email",
      "rule": "pattern",
      "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      "validValue": "usuario@empresa.com",
      "invalidValue": "not-an-email",
      "aiConfidence": 0.95
    },
    {
      "type": "mask_validation",
      "id": "unique-kebab-case-id",
      "name": "CPF mask validation",
      "field": "cpf",
      "maskPattern": "^\\\\d{3}\\\\.\\\\d{3}\\\\.\\\\d{3}-\\\\d{2}$",
      "validSamples": ["123.456.789-10"],
      "invalidSamples": ["12345678910"],
      "aiConfidence": 0.95
    },
    {
      "type": "contract_smoke",
      "id": "unique-kebab-case-id",
      "name": "Contract smoke: endpoint reachable",
      "description": "Verify endpoint is reachable",
      "contractName": "${contract.name}",
      "endpoint": "/health",
      "method": "GET",
      "aiConfidence": 0.95
    }
  ]
}

Rules:
- aiConfidence between 0 and 1
- All IDs must be unique (use kebab-case)
- Use realistic Brazilian test data (CPF, telefone, CEP, e-mail, nome completo)
- If generating a login case, put it FIRST so token is available for subsequent cases
- Never hardcode real passwords — use the TEST_PASSWORD env var placeholder
- For field_validation, validValue must pass the rule, invalidValue must fail
- For browser_flow with forms, use type_slow for masked fields and select for dropdowns
- Add screenshot steps after important actions to capture evidence
- Prefer data-testid, aria-label, name attributes over CSS classes for selectors`;

  try {
    const result = await generateJson<GeneratedCaseBatch>(prompt);
    return (result.cases || []).map((c, idx) => enrichCase(c, contract.name, idx));
  } catch (err) {
    console.error(`[aiTestGenerator] Failed to generate cases for ${contract.name}:`, err);
    return [buildFallbackContractSmoke(contract, input.targetBaseUrl)];
  }
}

async function generateCasesForFeature(
  feature: FeatureDescription,
  input: GenerationInput
): Promise<TestCase[]> {
  const hasAuth = !!(process.env.TEST_USERNAME && process.env.TEST_PASSWORD);

  const prompt = `You are a world-class QA engineer. Analyze the following feature and generate production-grade automated test cases.

FEATURE: ${feature.title}
DESCRIPTION: ${feature.description}
ACCEPTANCE CRITERIA:
${(feature.acceptanceCriteria || []).map((c) => `- ${c}`).join("\n")}

TARGET API BASE URL: ${input.targetBaseUrl}
TARGET BROWSER URL: ${input.targetBrowserUrl}
AUTH CONFIGURED: ${hasAuth ? "yes — TEST_USERNAME and TEST_PASSWORD available" : "no"}

Generate test cases covering:
1. ${hasAuth ? "Login flow FIRST (browser login or API login to get token)" : "Unauthenticated API/browser tests"}
2. Happy path (valid data, expected success)
3. Error cases (invalid inputs, unauthorized access)
4. Browser E2E flow (navigate → interact → assert)
5. Forms with select dropdowns, masked inputs, and multi-step interactions

AVAILABLE BROWSER FLOW ACTIONS:
navigate, click, double_click, fill, type_slow (masked inputs), clear, select (dropdowns — use optionValue/optionText/optionIndex), hover, press_key, scroll_to, screenshot, assert_text, assert_visible, assert_not_visible, assert_url, assert_count, assert_value, wait, wait_for_response, login, assert_authenticated, save_session

Return a JSON object:
{
  "cases": [
    {
      "type": "browser_flow",
      "id": "feat-login-flow",
      "name": "Login and access feature",
      "description": "Open app, login, navigate to feature, verify it works",
      "steps": [
        { "action": "navigate", "url": "/" },
        ${hasAuth ? `{ "action": "login", "url": "/login" },
        { "action": "assert_authenticated" },
        { "action": "screenshot", "value": "logged-in" },` : ""}
        { "action": "navigate", "url": "/feature-page" },
        { "action": "assert_visible", "selector": "main" },
        { "action": "screenshot", "value": "feature-loaded" }
      ],
      "aiConfidence": 0.85
    },
    {
      "type": "browser_flow",
      "id": "feat-form-with-select",
      "name": "Fill feature form including dropdowns",
      "description": "Complete form with text, masked, and select fields",
      "steps": [
        { "action": "navigate", "url": "/feature-form" },
        { "action": "fill", "selector": "input[name=nome]", "value": "Maria Oliveira" },
        { "action": "type_slow", "selector": "input[name=telefone]", "value": "(11) 99999-9999" },
        { "action": "select", "selector": "select[name=tipo]", "optionIndex": 1 },
        { "action": "screenshot", "value": "form-before-submit" },
        { "action": "click", "selector": "button[type=submit]" },
        { "action": "assert_visible", "selector": ".success, [data-success], .toast-success" }
      ],
      "aiConfidence": 0.82
    },
    {
      "type": "api",
      "id": "feat-api-happy",
      "name": "Feature API happy path",
      "description": "Valid request returns expected response",
      "endpoint": "/api/feature",
      "method": "GET",
      "headers": {},
      "body": null,
      "expectedStatus": 200,
      "useStoredToken": ${hasAuth},
      "expectedBodyContains": {},
      "aiConfidence": 0.85
    }
  ]
}

Rules:
- Put login/auth cases FIRST
- Use data-testid, aria-label, name, id attributes (NOT generic CSS classes like .btn)
- For masked inputs (CPF, phone, CEP) use type_slow
- For dropdowns use select with optionValue, optionText, or optionIndex
- Add screenshot steps after key interactions for evidence
- Generate maximum ${input.maxCasesPerContract} cases total
- Use "useStoredToken": true for authenticated API cases when auth is configured`;

  try {
    const result = await generateJson<GeneratedCaseBatch>(prompt);
    return (result.cases || []).map((c, idx) => enrichCase(c, feature.title, idx));
  } catch (err) {
    console.error(`[aiTestGenerator] Failed to generate cases for feature ${feature.title}:`, err);
    return [];
  }
}

function enrichCase(rawCase: unknown, sourceName: string, idx: number): TestCase {
  const c = rawCase as Record<string, unknown>;
  if (!c.id || typeof c.id !== "string") {
    c.id = `${sourceName.toLowerCase().replace(/\s+/g, "-")}-case-${idx + 1}`;
  }
  if (typeof c.aiConfidence !== "number") {
    c.aiConfidence = 0.7;
  }
  return c as unknown as TestCase;
}

function buildFallbackContractSmoke(
  contract: LoadedContract,
  targetBaseUrl: string
): ContractSmokeCase {
  const endpoint = contract.schema.endpoint || "/api/health";
  const method = (contract.schema.method || "GET") as string;
  return {
    type: "contract_smoke",
    id: `${contract.name}-smoke-fallback`,
    name: `Smoke: ${contract.name} contract endpoint reachable`,
    description: `Verify that ${method} ${endpoint} is reachable at ${targetBaseUrl}`,
    contractName: contract.name,
    endpoint,
    method,
    aiConfidence: 0.6,
  };
}

function buildFallbackFeatureCases(feature: FeatureDescription, input: GenerationInput): TestCase[] {
  const featureSlug = feature.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const isValidationFeature = feature.title.toLowerCase().includes("field validation");
  const isMaskFeature = feature.title.toLowerCase().includes("mask validation");
  const isFrontendFeature = feature.title.toLowerCase().includes("frontend flow");
  const cases: TestCase[] = [];

  if (isValidationFeature) {
    cases.push({
      type: "field_validation",
      id: `${featureSlug}-field-validation`,
      name: feature.title,
      field: "email",
      rule: "required",
      validValue: "qa@empresa.com",
      invalidValue: "",
      aiConfidence: 0.75,
    });
    return cases;
  }

  if (isMaskFeature) {
    cases.push({
      type: "mask_validation",
      id: `${featureSlug}-mask-validation`,
      name: feature.title,
      field: "cpf",
      maskPattern: "^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$",
      validSamples: ["123.456.789-10"],
      invalidSamples: ["12345678910"],
      aiConfidence: 0.75,
    });
    return cases;
  }

  if (isFrontendFeature) {
    cases.push({
      type: "browser_flow",
      id: `${featureSlug}-browser-flow`,
      name: feature.title,
      description: feature.description,
      steps: [
        { action: "navigate", url: input.targetBrowserUrl },
        { action: "assert_visible", selector: "body" },
      ],
      aiConfidence: 0.7,
    });
    return cases;
  }

  cases.push({
    type: "api",
    id: `${featureSlug}-api-check`,
    name: feature.title,
    description: feature.description,
    endpoint: "/health",
    method: "GET",
    expectedStatus: 200,
    aiConfidence: 0.7,
  });

  return cases;
}

function buildFallbackBrowserFlow(targetBrowserUrl: string): BrowserTestCase {
  const hasAuth = !!(process.env.TEST_USERNAME && process.env.TEST_PASSWORD);
  const authUrl = process.env.TEST_AUTH_URL || "/login";

  return hasAuth
    ? {
        type: "browser_flow",
        id: "codex-browser-login-fallback",
        name: "Browser smoke: abrir app e validar login",
        description: `Open ${targetBrowserUrl}, perform login, and verify authenticated state`,
        steps: [
          { action: "navigate", url: targetBrowserUrl },
          { action: "login", url: authUrl, storageKey: "default_bearer" },
          { action: "assert_authenticated" },
          { action: "save_session" },
        ],
        aiConfidence: 0.8,
      }
    : {
        type: "browser_flow",
        id: "codex-browser-home-fallback",
        name: "Browser smoke: abrir homepage",
        description: `Open ${targetBrowserUrl} and verify the page renders`,
        steps: [
          { action: "navigate", url: targetBrowserUrl },
          { action: "assert_visible", selector: "body" },
        ],
        aiConfidence: 0.75,
      };
}

function isBrowserOnlyMode(): boolean {
  return process.env.RUN_MODE === "browser";
}

function generateDefaultSmokeCases(targetBaseUrl: string): TestCase[] {
  const hasAuth = !!(process.env.TEST_USERNAME && process.env.TEST_PASSWORD);
  const authUrl = process.env.TEST_AUTH_URL || "/login";

  const healthCase: ApiTestCase = {
    type: "api",
    id: "default-health-check",
    name: "Default: API health check",
    description: `Verify the API at ${targetBaseUrl} is reachable`,
    endpoint: "/health",
    method: "GET",
    expectedStatus: 200,
    aiConfidence: 0.5,
  };

  const fieldCase: FieldValidationCase = {
    type: "field_validation",
    id: "default-email-required",
    name: "Default: email field required validation",
    field: "email",
    rule: "required",
    validValue: "user@example.com",
    invalidValue: "",
    aiConfidence: 0.9,
  };

  const maskCase: MaskValidationCase = {
    type: "mask_validation",
    id: "default-cpf-mask",
    name: "Default: CPF mask validation",
    field: "cpf",
    maskPattern: "^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$",
    validSamples: ["123.456.789-10"],
    invalidSamples: ["12345678910", "123.456.789-1"],
    aiConfidence: 0.95,
  };

  // Auth-aware browser flow
  const browserCase: BrowserTestCase = hasAuth
    ? {
        type: "browser_flow",
        id: "default-login-flow",
        name: "Default: login and verify authenticated state",
        description: "Open app, perform login, store session, assert authenticated",
        steps: [
          { action: "navigate", url: targetBaseUrl },
          { action: "login", url: authUrl, storageKey: "default_bearer" },
          { action: "assert_authenticated" },
          { action: "save_session" },
        ],
        aiConfidence: 0.85,
      }
    : {
        type: "browser_flow",
        id: "default-page-load",
        name: "Default: homepage loads",
        description: "Verify the application homepage is accessible",
        steps: [
          { action: "navigate", url: targetBaseUrl },
          { action: "assert_visible", selector: "body" },
        ],
        aiConfidence: 0.7,
      };

  // Authenticated API smoke if auth is configured
  const cases: TestCase[] = [healthCase, fieldCase, maskCase, browserCase];

  if (hasAuth) {
    const loginApiCase: ApiTestCase = {
      type: "api",
      id: "default-api-login",
      name: "Default: API login and get token",
      description: "POST login endpoint with test credentials, store JWT token",
      endpoint: process.env.TEST_AUTH_ENDPOINT || "/api/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        email: process.env.TEST_USERNAME,
        password: process.env.TEST_PASSWORD,
      },
      expectedStatus: 200,
      extractTokenToKey: "default_bearer",
      aiConfidence: 0.8,
    };
    cases.unshift(loginApiCase); // Login first
  }

  return cases;
}
