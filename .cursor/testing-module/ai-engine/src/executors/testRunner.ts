import type {
  TestCase,
  TestResult,
  RunMode,
  ApiTestCase,
  BrowserTestCase,
  FieldValidationCase,
  MaskValidationCase,
  ContractSmokeCase,
} from "../types/index.js";
import {
  runApiCase,
  runContractSmokeCase,
  runFieldValidationCase,
  runMaskValidationCase,
} from "./apiExecutor.js";
import { runBrowserCase, closeBrowser } from "./playwrightExecutor.js";

export interface RunnerConfig {
  targetBaseUrl: string;
  targetBrowserUrl: string;
  runMode: RunMode;
}

export async function runAllCases(
  cases: TestCase[],
  config: RunnerConfig
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const filteredCases = filterByMode(cases, config.runMode);
  console.log(
    `[testRunner] Running ${filteredCases.length} cases (mode: ${config.runMode})`
  );

  const nonBrowserCases = filteredCases.filter((c) => c.type !== "browser_flow");
  const browserCases = filteredCases.filter(
    (c): c is BrowserTestCase => c.type === "browser_flow"
  );

  for (const testCase of nonBrowserCases) {
    const result = await runSingleCase(testCase, config);
    results.push(result);
    logCaseResult(result);
  }

  if (browserCases.length > 0) {
    console.log(`[testRunner] Running ${browserCases.length} browser cases...`);
    for (const testCase of browserCases) {
      const result = await runBrowserCase(testCase, config.targetBrowserUrl);
      results.push(result);
      logCaseResult(result);
    }
    await closeBrowser();
  }

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const errored = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log(
    `[testRunner] Done — Passed: ${passed} | Failed: ${failed} | Error: ${errored} | Skipped: ${skipped}`
  );

  return results;
}

async function runSingleCase(
  testCase: TestCase,
  config: RunnerConfig
): Promise<TestResult> {
  switch (testCase.type) {
    case "api":
      return runApiCase(testCase as ApiTestCase, config.targetBaseUrl);

    case "contract_smoke":
      return runContractSmokeCase(
        testCase as ContractSmokeCase,
        config.targetBaseUrl
      );

    case "field_validation":
      return runFieldValidationCase(testCase as FieldValidationCase);

    case "mask_validation":
      return runMaskValidationCase(testCase as MaskValidationCase);

    default:
      return {
        id: (testCase as TestCase).id,
        type: (testCase as TestCase).type,
        name: (testCase as { name: string }).name || "Unknown",
        status: "skipped",
        expected: "N/A",
        actual: `Unsupported case type: ${(testCase as TestCase).type}`,
        durationMs: 0,
        aiConfidence: 0,
        evidence: { logs: [`Unsupported type: ${(testCase as TestCase).type}`] },
      };
  }
}

function filterByMode(cases: TestCase[], mode: RunMode): TestCase[] {
  if (mode === "all") return cases;

  return cases.filter((c) => {
    switch (mode) {
      case "api":
        return c.type === "api" || c.type === "contract_smoke";
      case "browser":
        return c.type === "browser_flow";
      case "generate":
        return false;
      default:
        return true;
    }
  });
}

function logCaseResult(result: TestResult): void {
  const icon =
    result.status === "passed"
      ? "PASS"
      : result.status === "failed"
      ? "FAIL"
      : result.status === "error"
      ? "ERROR"
      : "SKIP";
  console.log(`  [${icon}] ${result.name} (${result.durationMs}ms)`);
  if (result.status !== "passed" && result.status !== "skipped") {
    console.log(`         Expected: ${result.expected}`);
    console.log(`         Actual:   ${result.actual}`);
  }
}
