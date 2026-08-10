export type TestCaseType =
  | "api"
  | "browser_flow"
  | "field_validation"
  | "mask_validation"
  | "contract_smoke";

export type TestStatus = "passed" | "failed" | "skipped" | "error";

export type RunMode = "all" | "api" | "browser" | "generate" | "retry-failed";

export interface ContractSchema {
  version: string;
  module: string;
  endpoint?: string;
  method?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  errors?: Array<{ code: string; message: string }>;
  domain_rules?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LoadedContract {
  filePath: string;
  name: string;
  schema: ContractSchema;
}

export interface FeatureDescription {
  title: string;
  description: string;
  acceptanceCriteria?: string[];
}

export interface GenerationInput {
  contracts: LoadedContract[];
  features?: FeatureDescription[];
  maxCasesPerContract: number;
  targetBaseUrl: string;
  targetBrowserUrl: string;
}

export interface ApiTestCase {
  type: "api";
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
  expectedBodyContains?: Record<string, unknown>;
  expectedSchema?: Record<string, unknown>;
  aiConfidence: number;
  // Auth fields
  useStoredToken?: boolean;           // auto-inject token from sessionManager
  storedTokenKey?: string;            // which stored token key to use (default: "default_bearer")
  extractTokenToKey?: string;         // if response has a token, store it with this key
  tokenType?: "bearer" | "api-key";  // how to inject the token (default: "bearer")
  // Variable extraction — store response field into a named variable for use in later cases
  extractVars?: Record<string, string>; // { "myVar": "response.body.path.to.field" }
  // Variable substitution — replace {{myVar}} placeholders in endpoint, body, headers
  useVars?: true;
}

export interface BrowserFlowStep {
  action:
    | "navigate"
    | "click"
    | "double_click"        // double-click on element
    | "fill"
    | "type_slow"           // type character by character (for masked inputs)
    | "clear"               // clear a field before filling
    | "select"              // select an option from <select> dropdown
    | "hover"               // hover over element (triggers tooltips/dropdowns)
    | "press_key"           // press a keyboard key (e.g. Enter, Tab, Escape)
    | "scroll_to"           // scroll element into view
    | "screenshot"          // take a named screenshot mid-flow
    | "assert_text"
    | "assert_visible"
    | "assert_not_visible"  // assert element is NOT visible
    | "assert_url"
    | "assert_count"        // assert number of matching elements
    | "assert_value"        // assert input/select current value
    | "wait"
    | "wait_for_response"   // wait for a network response matching a URL pattern
    // Auth-aware actions
    | "login"               // fill credentials + submit, then save session
    | "store_token"         // extract token from page/localStorage and persist it
    | "use_token"           // inject stored token into next request header
    | "assert_authenticated" // verify user is authenticated (check element or URL)
    | "read_localStorage"   // read a key from localStorage (assert or store)
    | "write_localStorage"  // write a key-value to localStorage
    | "get_cookie"          // read a cookie value (assert or store)
    | "save_session"        // persist full browser storageState (cookies + storage)
    | "restore_session";    // restore previously saved storageState
  selector?: string;
  value?: string;           // text value, key name, URL pattern, or screenshot label
  url?: string;
  timeout?: number;
  count?: number;           // for assert_count
  optionValue?: string;     // for select: option value attribute
  optionText?: string;      // for select: option visible text (label)
  optionIndex?: number;     // for select: option by index (0-based)
  // Auth-specific fields
  usernameSelector?: string;   // for "login" action
  passwordSelector?: string;   // for "login" action
  submitSelector?: string;     // for "login" action
  username?: string;           // credential (falls back to TEST_USERNAME env)
  password?: string;           // credential (falls back to TEST_PASSWORD env)
  storageKey?: string;         // key to use in sessionManager for store/get operations
  localStorageKey?: string;    // for read/write_localStorage
  cookieName?: string;         // for get_cookie
  tokenField?: string;         // field name to look for in localStorage/response
}

export interface BrowserTestCase {
  type: "browser_flow";
  id: string;
  name: string;
  description: string;
  steps: BrowserFlowStep[];
  aiConfidence: number;
}

export interface FieldValidationCase {
  type: "field_validation";
  id: string;
  name: string;
  field: string;
  rule: "required" | "minLength" | "maxLength" | "pattern" | "range";
  validValue: string;
  invalidValue: string;
  aiConfidence: number;
  minLength?: number;   // for rule "minLength"
  maxLength?: number;   // for rule "maxLength"
  pattern?: string;     // regex string for rule "pattern"
  min?: number;         // for rule "range"
  max?: number;         // for rule "range"
}

export interface MaskValidationCase {
  type: "mask_validation";
  id: string;
  name: string;
  field: string;
  maskPattern: string;
  validSamples: string[];
  invalidSamples: string[];
  aiConfidence: number;
}

export interface ContractSmokeCase {
  type: "contract_smoke";
  id: string;
  name: string;
  description: string;
  contractName: string;
  endpoint: string;
  method: string;
  aiConfidence: number;
}

export type TestCase =
  | ApiTestCase
  | BrowserTestCase
  | FieldValidationCase
  | MaskValidationCase
  | ContractSmokeCase;

export interface Evidence {
  logs: string[];
  screenshotPath?: string;
  tracePath?: string;
  responseBody?: unknown;
  requestBody?: unknown;
  errorMessage?: string;
}

export interface TestResult {
  id: string;
  type: TestCaseType;
  name: string;
  status: TestStatus;
  expected: string;
  actual: string;
  durationMs: number;
  aiConfidence: number;
  evidence: Evidence;
  aiAnalysis?: AiFailureAnalysis;
}

export interface AiFailureAnalysis {
  rootCause: string;
  severity: "low" | "medium" | "high" | "critical";
  suggestion: string;
  category:
    | "regression"
    | "configuration"
    | "data"
    | "environment"
    | "flaky"
    | "unknown";
}

export interface QualityScore {
  total: number;
  band: "critical" | "warning" | "acceptable" | "excellent";
  breakdown: {
    passRate: number;
    passRateScore: number;
    aiConfidenceAvg: number;
    aiConfidenceScore: number;
    realCasesRatio: number;
    realCasesScore: number;
    coverageBreadth: number;
    coverageBreadthScore: number;
  };
}

export interface RunSummary {
  totalCases: number;
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  durationMs: number;
  passRate: number;
}

export interface QualityReport {
  success: boolean;
  generatedAt: string;
  runMode: RunMode;
  targetBaseUrl: string;
  summary: RunSummary;
  qualityScore: QualityScore;
  results: TestResult[];
  aiInsights: string[];
  artifacts: {
    reportJsonPath: string;
    reportHtmlPath: string;
    activityLogPath?: string;
  };
}

export interface PipelineConfig {
  geminiApiKey: string;
  geminiModel: string;
  targetBaseUrl: string;
  targetBrowserUrl: string;
  runMode: RunMode;
  maxCasesPerContract: number;
  contractsPath: string;
  reportJsonPath: string;
  reportHtmlPath: string;
  activityLogPath: string;
  repoRoot: string;
}
