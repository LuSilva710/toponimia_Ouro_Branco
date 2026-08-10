import fs from "fs";
import path from "path";
import type {
  TestResult,
  QualityScore,
  QualityReport,
  RunMode,
} from "../types/index.js";

export function computeQualityScore(results: TestResult[]): QualityScore {
  const total = results.length;
  const passed = results.filter((r) => r.status === "passed").length;
  const realCases = results.filter(
    (r) => r.type === "api" || r.type === "browser_flow"
  ).length;

  const passRate = total > 0 ? passed / total : 0;
  const passRateScore = Math.round(passRate * 50);

  const aiConfidenceAvg =
    results.length > 0
      ? results.reduce((acc, r) => acc + (r.aiConfidence || 0), 0) / results.length
      : 0;
  const aiConfidenceScore = Math.round(aiConfidenceAvg * 20);

  const realCasesRatio = total > 0 ? realCases / total : 0;
  const realCasesScore = Math.round(realCasesRatio * 20);

  const typesSeen = new Set(results.map((r) => r.type));
  const coverageBreadth = Math.min(typesSeen.size / 4, 1);
  const coverageBreadthScore = Math.round(coverageBreadth * 10);

  const total_score = passRateScore + aiConfidenceScore + realCasesScore + coverageBreadthScore;

  const band =
    total_score >= 85
      ? "excellent"
      : total_score >= 70
      ? "acceptable"
      : total_score >= 50
      ? "warning"
      : "critical";

  return {
    total: total_score,
    band,
    breakdown: {
      passRate: Math.round(passRate * 100) / 100,
      passRateScore,
      aiConfidenceAvg: Math.round(aiConfidenceAvg * 100) / 100,
      aiConfidenceScore,
      realCasesRatio: Math.round(realCasesRatio * 100) / 100,
      realCasesScore,
      coverageBreadth: Math.round(coverageBreadth * 100) / 100,
      coverageBreadthScore,
    },
  };
}

export function buildQualityReport(
  results: TestResult[],
  insights: string[],
  runMode: RunMode,
  targetBaseUrl: string,
  reportJsonPath: string,
  reportHtmlPath: string,
  startTime: number
): QualityReport {
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errored = results.filter((r) => r.status === "error").length;
  const total = results.length;
  const durationMs = Date.now() - startTime;
  const passRate = total > 0 ? Math.round((passed / total) * 10000) / 10000 : 0;

  const qualityScore = computeQualityScore(results);
  const success = failed === 0 && errored === 0;

  return {
    success,
    generatedAt: new Date().toISOString(),
    runMode,
    targetBaseUrl,
    summary: {
      totalCases: total,
      passed,
      failed,
      skipped,
      errored,
      durationMs,
      passRate,
    },
    qualityScore,
    results,
    aiInsights: insights,
    artifacts: {
      reportJsonPath,
      reportHtmlPath,
    },
  };
}

export function writeJsonReport(report: QualityReport, filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`[qualityReporter] JSON report written: ${filePath}`);
}

export function writeTmpSnapshot(report: QualityReport, reportsDir: string): void {
  const tmpDir = path.join(reportsDir, "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const tmpPath = path.join(tmpDir, `ai-final-report-${ts}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`[qualityReporter] Snapshot written: ${tmpPath}`);
}

export function appendRunHistory(report: QualityReport, reportsDir: string): void {
  const historyDir = path.join(reportsDir, "history");
  fs.mkdirSync(historyDir, { recursive: true });

  const historyPath = path.join(historyDir, "ai-run-history.jsonl");
  const record = {
    timestamp: report.generatedAt,
    runMode: report.runMode,
    success: report.success,
    totalCases: report.summary.totalCases,
    passed: report.summary.passed,
    failed: report.summary.failed,
    skipped: report.summary.skipped,
    errored: report.summary.errored,
    passRate: report.summary.passRate,
    durationMs: report.summary.durationMs,
    qualityScore: report.qualityScore.total,
    qualityBand: report.qualityScore.band,
  };

  fs.appendFileSync(historyPath, JSON.stringify(record) + "\n", "utf-8");

  const summaryPath = path.join(historyDir, "ai-summary.json");
  let history: typeof record[] = [];
  if (fs.existsSync(historyPath)) {
    const lines = fs.readFileSync(historyPath, "utf-8").split("\n").filter(Boolean);
    history = lines.map((l) => JSON.parse(l) as typeof record);
  }

  const avgScore =
    history.length > 0
      ? Math.round(history.reduce((a, r) => a + r.qualityScore, 0) / history.length)
      : 0;
  const avgPassRate =
    history.length > 0
      ? Math.round((history.reduce((a, r) => a + r.passRate, 0) / history.length) * 10000) / 10000
      : 0;

  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalRuns: history.length,
        successRuns: history.filter((r) => r.success).length,
        failedRuns: history.filter((r) => !r.success).length,
        avgQualityScore: avgScore,
        avgPassRate,
        lastRun: record,
      },
      null,
      2
    ),
    "utf-8"
  );
}
