import "dotenv/config";
import path from "path";
import fs from "fs";
import { readContracts, readFeatureDescriptions } from "./generators/contractReader.js";
import { loadSwaggerContracts } from "./generators/swaggerReader.js";
import { generateTestCases } from "./generators/aiTestGenerator.js";
import { runAllCases } from "./executors/testRunner.js";
import { analyzeFailures, generateQualitySummary } from "./validators/aiResultValidator.js";
import {
  buildQualityReport,
  writeJsonReport,
  writeTmpSnapshot,
  appendRunHistory,
} from "./reporters/qualityReporter.js";
import { writeHtmlReport } from "./reporters/htmlReporter.js";
import { ActivityLogger } from "./reporters/activityLogger.js";
import { validateProviderConfig, getProviderLabel } from "./config/aiProvider.js";
import { clearAll as clearVars } from "./config/variableStore.js";
import type { PipelineConfig, RunMode } from "./types/index.js";

function resolveConfig(): PipelineConfig {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1];

  const runMode: RunMode = (
    modeArg === "api" || modeArg === "browser" || modeArg === "generate" || modeArg === "retry-failed"
      ? modeArg
      : process.env.RUN_MODE === "api" ||
        process.env.RUN_MODE === "browser" ||
        process.env.RUN_MODE === "generate" ||
        process.env.RUN_MODE === "retry-failed"
      ? (process.env.RUN_MODE as RunMode)
      : "all"
  ) as RunMode;

  const repoRoot = path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
    "..",
    "..",
    "..",
    ".."
  );

  return {
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    targetBaseUrl: process.env.TARGET_BASE_URL || "http://localhost:3000",
    targetBrowserUrl: process.env.TARGET_BROWSER_URL || process.env.TARGET_BASE_URL || "http://localhost:3000",
    runMode,
    maxCasesPerContract: parseInt(process.env.MAX_CASES_PER_CONTRACT || "20", 10),
    contractsPath: path.resolve(repoRoot, process.env.CONTRACTS_PATH || ".cursor/contracts"),
    reportJsonPath: path.resolve(repoRoot, process.env.AI_REPORT_PATH || ".cursor/testing-module/reports/ai-final-report.json"),
    reportHtmlPath: path.resolve(repoRoot, process.env.AI_HTML_REPORT_PATH || ".cursor/testing-module/reports/ai-final-report.html"),
    activityLogPath: path.resolve(repoRoot, process.env.AI_ACTIVITY_LOG_PATH || ".cursor/testing-module/reports/ai-activity-log.md"),
    repoRoot,
  };
}

async function runRetryFailed(
  config: PipelineConfig,
  activityLogger: import("./reporters/activityLogger.js").ActivityLogger,
  startTime: number
): Promise<void> {
  console.log("\n[retry-failed] Loading previous report to find failed cases...");

  if (!fs.existsSync(config.reportJsonPath)) {
    console.error(`[retry-failed] No previous report found at: ${config.reportJsonPath}`);
    console.error("  Run the engine once in 'all' or 'api' or 'browser' mode first.");
    process.exit(1);
  }

  const previousReport = JSON.parse(
    fs.readFileSync(config.reportJsonPath, "utf-8")
  ) as import("./types/index.js").QualityReport;

  const failedIds = new Set(
    previousReport.results
      .filter((r) => r.status === "failed" || r.status === "error")
      .map((r) => r.id)
  );

  if (failedIds.size === 0) {
    console.log("[retry-failed] No failed or errored cases in the previous report. Nothing to retry.");
    process.exit(0);
  }

  console.log(`[retry-failed] Found ${failedIds.size} case(s) to retry: ${[...failedIds].join(", ")}`);
  activityLogger.log("RETRY", `Retrying ${failedIds.size} failed case(s)`);

  // Re-generate all cases and filter to only the failed ones
  const { readContracts: rc, readFeatureDescriptions: rfd } = await import("./generators/contractReader.js");
  const { generateTestCases: gtc } = await import("./generators/aiTestGenerator.js");

  const contracts = await rc(config.contractsPath);
  const features = rfd(process.env.FEATURES_PATH);
  const allCases = await gtc({
    contracts,
    features,
    maxCasesPerContract: config.maxCasesPerContract,
    targetBaseUrl: config.targetBaseUrl,
    targetBrowserUrl: config.targetBrowserUrl,
  });

  const casesToRetry = allCases.filter((c) => failedIds.has((c as { id: string }).id));

  if (casesToRetry.length === 0) {
    console.log("[retry-failed] Previously failed case IDs not found in newly generated cases.");
    console.log("  This can happen when the AI generates different IDs. Running all cases instead.");
    // Fall through to run all
  }

  const finalCases = casesToRetry.length > 0 ? casesToRetry : allCases;
  console.log(`[retry-failed] Executing ${finalCases.length} case(s)...`);

  const { runAllCases: rac } = await import("./executors/testRunner.js");
  const rawResults = await rac(finalCases, {
    targetBaseUrl: config.targetBaseUrl,
    targetBrowserUrl: config.targetBrowserUrl,
    runMode: "all",
  });

  const { analyzeFailures: af, generateQualitySummary: gqs } = await import("./validators/aiResultValidator.js");
  const { enrichedResults, insights } = await af(rawResults);

  const passed = enrichedResults.filter((r) => r.status === "passed").length;
  const failed = enrichedResults.filter((r) => r.status === "failed").length;

  const { buildQualityReport: bqr, writeJsonReport: wjr, writeTmpSnapshot: wts, appendRunHistory: arh } = await import("./reporters/qualityReporter.js");
  const { writeHtmlReport: whr } = await import("./reporters/htmlReporter.js");

  const report = bqr(enrichedResults, insights, "all", config.targetBaseUrl, config.reportJsonPath, config.reportHtmlPath, startTime);
  const aiSummary = await gqs(passed, failed, report.summary.skipped, report.qualityScore.total);
  report.aiInsights = [`[retry-failed] Retried ${failedIds.size} previously failing case(s). ${aiSummary}`];
  report.artifacts.activityLogPath = config.activityLogPath;

  const reportsDir = path.dirname(config.reportJsonPath);
  wjr(report, config.reportJsonPath);
  whr(report, config.reportHtmlPath);
  wts(report, reportsDir);
  arh(report, reportsDir);

  printSummary(report);

  if (!report.success) process.exit(1);
}

async function run(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  ROVIS AI Testing Engine");
  console.log("  MCP Servers: gemini, codex | Config: .cursor/mcp.json");
  console.log("=".repeat(60));
  console.log("  Fluxo: MCP (Cursor) → Engine → Playwright → Report\n");

  const config = resolveConfig();
  const startTime = Date.now();
  const activityLogger = new ActivityLogger();

  clearVars(); // reset dynamic variables at the start of every run
  activityLogger.log("START", "ROVIS AI Testing Engine started");
  activityLogger.logConfig({
    provider: getProviderLabel(),
    mode: config.runMode,
    targetApi: config.targetBaseUrl,
    targetBrowser: config.targetBrowserUrl,
    maxCasesPerContract: config.maxCasesPerContract,
    contractsPath: config.contractsPath,
  });

  try {
    validateProviderConfig();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    activityLogger.log("ERROR", "Provider config validation failed", msg);
    console.error("\n[ERROR]", msg);
    process.exit(1);
  }

  console.log(`[config] AI Provider: ${getProviderLabel()}`);
  console.log(`[config] Mode: ${config.runMode}`);
  console.log(`[config] Target API: ${config.targetBaseUrl}`);
  console.log(`[config] Target Browser: ${config.targetBrowserUrl}`);
  console.log(`[config] Contracts: ${config.contractsPath}`);
  console.log(`[config] Max cases/contract: ${config.maxCasesPerContract}`);
  if (process.env.SWAGGER_JSON_URL) {
    console.log(`[config] Swagger JSON: ${process.env.SWAGGER_JSON_URL}`);
  }

  // ── RETRY-FAILED mode ──────────────────────────────────────────
  if (config.runMode === "retry-failed") {
    await runRetryFailed(config, activityLogger, startTime);
    return;
  }

  console.log("\n[Step 1/5] Reading contracts and features...");
  activityLogger.log("STEP", "Step 1/5 — Reading contracts and features");
  const fileContracts = await readContracts(config.contractsPath);
  const swaggerContracts = await loadSwaggerContracts();
  const contracts = [...fileContracts, ...swaggerContracts];
  const features = readFeatureDescriptions(process.env.FEATURES_PATH);
  activityLogger.logContractsLoaded(contracts);
  activityLogger.log("FEATURES", `${features.length} feature description(s) loaded`);
  if (swaggerContracts.length > 0) {
    console.log(`  Contracts from files: ${fileContracts.length}`);
    console.log(`  Contracts from Swagger: ${swaggerContracts.length}`);
  }
  console.log(`  Contracts total: ${contracts.length}`);
  console.log(`  Features loaded: ${features.length}`);

  console.log(`
[Step 2/5] Generating test cases with ${getProviderLabel()}...`);
  activityLogger.log("STEP", `Step 2/5 — Generating test cases with ${getProviderLabel()}`);
  const testCases = await generateTestCases({
    contracts,
    features,
    maxCasesPerContract: config.maxCasesPerContract,
    targetBaseUrl: config.targetBaseUrl,
    targetBrowserUrl: config.targetBrowserUrl,
  });
  activityLogger.logTestCasesGenerated(testCases);
  console.log(`  Test cases generated: ${testCases.length}`);

  if (config.runMode === "generate") {
    activityLogger.log("MODE", "generate-only mode — skipping execution");
    console.log("\n[Mode: generate] Skipping execution — saving generated cases only.");
    const generateOnlyReport = buildQualityReport(
      testCases.map((tc) => ({
        id: (tc as { id: string }).id,
        type: tc.type,
        name: (tc as { name: string }).name,
        status: "skipped" as const,
        expected: "Generation only mode",
        actual: "Not executed",
        durationMs: 0,
        aiConfidence: (tc as { aiConfidence: number }).aiConfidence || 0.5,
        evidence: { logs: ["Generation-only mode — skipped execution"] },
      })),
      [`Generated ${testCases.length} test cases in generate-only mode.`],
      config.runMode,
      config.targetBaseUrl,
      config.reportJsonPath,
      config.reportHtmlPath,
      startTime
    );
    generateOnlyReport.artifacts.activityLogPath = config.activityLogPath;
    writeJsonReport(generateOnlyReport, config.reportJsonPath);
    writeHtmlReport(generateOnlyReport, config.reportHtmlPath);
    activityLogger.logArtifact("JSON Report", config.reportJsonPath);
    activityLogger.logArtifact("HTML Report", config.reportHtmlPath);
    activityLogger.writeActivityLog(config.activityLogPath, generateOnlyReport);
    printSummary(generateOnlyReport);
    return;
  }

  console.log("\n[Step 3/5] Executing tests...");
  activityLogger.log("STEP", "Step 3/5 — Executing tests");
  const rawResults = await runAllCases(testCases, {
    targetBaseUrl: config.targetBaseUrl,
    targetBrowserUrl: config.targetBrowserUrl,
    runMode: config.runMode,
  });
  rawResults.forEach((r) => activityLogger.logTestExecution(r));
  activityLogger.log(
    "EXEC",
    `Execution complete`,
    `passed: ${rawResults.filter((r) => r.status === "passed").length}, failed: ${rawResults.filter((r) => r.status === "failed").length}`
  );

  console.log(`
[Step 4/5] AI failure analysis with ${getProviderLabel()}...`);
  activityLogger.log("STEP", `Step 4/5 — AI failure analysis with ${getProviderLabel()}`);
  const { enrichedResults, insights } = await analyzeFailures(rawResults);
  activityLogger.logAiInsights(insights);

  const passed = enrichedResults.filter((r) => r.status === "passed").length;
  const failed = enrichedResults.filter((r) => r.status === "failed").length;
  const report = buildQualityReport(
    enrichedResults,
    insights,
    config.runMode,
    config.targetBaseUrl,
    config.reportJsonPath,
    config.reportHtmlPath,
    startTime
  );

  const aiSummary = await generateQualitySummary(
    passed,
    failed,
    report.summary.skipped,
    report.qualityScore.total
  );
  report.aiInsights = [aiSummary, ...insights];
  report.artifacts.activityLogPath = config.activityLogPath;

  console.log("\n[Step 5/5] Writing reports...");
  activityLogger.log("STEP", "Step 5/5 — Writing reports");
  const reportsDir = path.dirname(config.reportJsonPath);
  writeJsonReport(report, config.reportJsonPath);
  writeHtmlReport(report, config.reportHtmlPath);
  writeTmpSnapshot(report, reportsDir);
  appendRunHistory(report, reportsDir);
  activityLogger.logArtifact("JSON Report", config.reportJsonPath);
  activityLogger.logArtifact("HTML Report", config.reportHtmlPath);
  activityLogger.log(
    "FINISH",
    `Quality Score: ${report.qualityScore.total}/100 [${report.qualityScore.band.toUpperCase()}]`,
    `success: ${report.success}`
  );
  activityLogger.writeActivityLog(config.activityLogPath, report);

  printSummary(report);

  if (!report.success) {
    process.exit(1);
  }
}

function printSummary(report: import("./types/index.js").QualityReport): void {
  const { summary, qualityScore } = report;
  console.log("\n" + "=".repeat(60));
  console.log(`  RESULTS — ${getProviderLabel()}`);
  console.log("=".repeat(60));
  console.log(`  Total:   ${summary.totalCases}`);
  console.log(`  Passed:  ${summary.passed}`);
  console.log(`  Failed:  ${summary.failed}`);
  console.log(`  Skipped: ${summary.skipped}`);
  console.log(`  Errors:  ${summary.errored}`);
  console.log(`  Pass Rate: ${Math.round(summary.passRate * 100)}%`);
  console.log(`  Duration: ${(summary.durationMs / 1000).toFixed(2)}s`);
  console.log("");
  console.log(`  Quality Score: ${qualityScore.total}/100 [${qualityScore.band.toUpperCase()}]`);
  console.log(`    Pass Rate Score:    ${qualityScore.breakdown.passRateScore}/50`);
  console.log(`    AI Confidence:      ${qualityScore.breakdown.aiConfidenceScore}/20`);
  console.log(`    Real Cases:         ${qualityScore.breakdown.realCasesScore}/20`);
  console.log(`    Coverage Breadth:   ${qualityScore.breakdown.coverageBreadthScore}/10`);
  console.log("");
  console.log(`  Reports:`);
  console.log(`    JSON: ${report.artifacts.reportJsonPath}`);
  console.log(`    HTML: ${report.artifacts.reportHtmlPath}`);

  if (report.aiInsights.length > 0) {
    console.log("\n  AI Insights:");
    report.aiInsights.slice(0, 3).forEach((insight) => {
      console.log(`    - ${insight}`);
    });
  }
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
