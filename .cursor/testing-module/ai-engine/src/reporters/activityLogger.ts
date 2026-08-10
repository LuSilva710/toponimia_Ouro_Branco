import fs from "fs";
import path from "path";
import type { TestResult, QualityReport, LoadedContract, TestCase } from "../types/index.js";

export interface ActivityLogEntry {
  timestamp: string;
  step: string;
  message: string;
  detail?: string;
}

export class ActivityLogger {
  private entries: ActivityLogEntry[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  log(step: string, message: string, detail?: string): void {
    const entry: ActivityLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      message,
      detail,
    };
    this.entries.push(entry);
    console.log(`[log] ${step} — ${message}${detail ? `: ${detail}` : ""}`);
  }

  logConfig(config: Record<string, string | number>): void {
    const detail = Object.entries(config)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    this.log("CONFIG", "Engine configuration loaded", detail);
  }

  logContractsLoaded(contracts: LoadedContract[]): void {
    this.log("CONTRACTS", `${contracts.length} contract(s) loaded`);
    contracts.forEach((c) => {
      this.log("CONTRACTS", `  → ${c.name}`, c.filePath);
    });
  }

  logTestCasesGenerated(cases: TestCase[]): void {
    const byType: Record<string, number> = {};
    cases.forEach((c) => {
      byType[c.type] = (byType[c.type] || 0) + 1;
    });
    const breakdown = Object.entries(byType)
      .map(([t, n]) => `${t}: ${n}`)
      .join(", ");
    this.log("GENERATE", `${cases.length} test case(s) generated`, breakdown);
    cases.forEach((c) => {
      this.log("GENERATE", `  → [${c.type}] ${(c as { name: string }).name}`);
    });
  }

  logTestExecution(result: TestResult): void {
    const icon = result.status === "passed" ? "✓" : result.status === "failed" ? "✗" : "~";
    this.log(
      "EXEC",
      `${icon} [${result.status.toUpperCase()}] ${result.name}`,
      `${result.durationMs}ms | confidence: ${Math.round(result.aiConfidence * 100)}%`
    );
    if (result.evidence.logs && result.evidence.logs.length > 0) {
      result.evidence.logs.forEach((line) => {
        this.log("EXEC", `      ${line}`);
      });
    }
    if (result.aiAnalysis) {
      this.log(
        "AI_ANALYSIS",
        `  Root cause [${result.aiAnalysis.severity}]: ${result.aiAnalysis.rootCause}`,
        `suggestion: ${result.aiAnalysis.suggestion}`
      );
    }
  }

  logAiInsights(insights: string[]): void {
    insights.forEach((insight) => {
      this.log("AI_INSIGHTS", insight);
    });
  }

  logArtifact(label: string, filePath: string): void {
    this.log("ARTIFACT", `${label} written`, filePath);
  }

  writeActivityLog(logFilePath: string, report: QualityReport): void {
    const dir = path.dirname(logFilePath);
    fs.mkdirSync(dir, { recursive: true });

    const totalDurationMs = Date.now() - this.startTime;
    const lines: string[] = [];

    lines.push(`# ROVIS AI Testing — Activity Log`);
    lines.push(``);
    lines.push(`**Generated at:** ${new Date().toLocaleString("pt-BR")}`);
    lines.push(`**Mode:** ${report.runMode}`);
    lines.push(`**Target:** ${report.targetBaseUrl || "N/A"}`);
    lines.push(`**Total Duration:** ${(totalDurationMs / 1000).toFixed(2)}s`);
    lines.push(``);

    lines.push(`## Summary`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Quality Score | **${report.qualityScore.total}/100** (${report.qualityScore.band.toUpperCase()}) |`);
    lines.push(`| Total Cases | ${report.summary.totalCases} |`);
    lines.push(`| Passed | ${report.summary.passed} |`);
    lines.push(`| Failed | ${report.summary.failed} |`);
    lines.push(`| Skipped | ${report.summary.skipped} |`);
    lines.push(`| Errors | ${report.summary.errored} |`);
    lines.push(`| Pass Rate | ${Math.round(report.summary.passRate * 100)}% |`);
    lines.push(`| Success | ${report.success ? "YES" : "NO"} |`);
    lines.push(``);

    lines.push(`## Score Breakdown`);
    lines.push(``);
    const bd = report.qualityScore.breakdown;
    lines.push(`| Criterion | Score |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Pass Rate | ${bd.passRateScore}/50 |`);
    lines.push(`| AI Confidence | ${bd.aiConfidenceScore}/20 |`);
    lines.push(`| Real Cases | ${bd.realCasesScore}/20 |`);
    lines.push(`| Coverage Breadth | ${bd.coverageBreadthScore}/10 |`);
    lines.push(``);

    if (report.aiInsights.length > 0) {
      lines.push(`## AI Insights`);
      lines.push(``);
      report.aiInsights.forEach((insight) => {
        lines.push(`- ${insight}`);
      });
      lines.push(``);
    }

    lines.push(`## Test Results`);
    lines.push(``);
    report.results.forEach((r) => {
      const icon = r.status === "passed" ? "✅" : r.status === "failed" ? "❌" : r.status === "error" ? "💥" : "⏭️";
      lines.push(`### ${icon} ${r.name}`);
      lines.push(``);
      lines.push(`- **Status:** ${r.status.toUpperCase()}`);
      lines.push(`- **Type:** ${r.type}`);
      lines.push(`- **Duration:** ${r.durationMs}ms`);
      lines.push(`- **AI Confidence:** ${Math.round(r.aiConfidence * 100)}%`);
      lines.push(`- **Expected:** ${r.expected}`);
      lines.push(`- **Actual:** ${r.actual}`);
      if (r.evidence.screenshotPath) {
        lines.push(`- **Screenshot:** ${r.evidence.screenshotPath}`);
      }
      if (r.evidence.tracePath) {
        lines.push(`- **Trace:** ${r.evidence.tracePath}`);
      }
      if (r.evidence.logs && r.evidence.logs.length > 0) {
        lines.push(``);
        lines.push(`**Logs:**`);
        lines.push(``);
        lines.push("```");
        r.evidence.logs.forEach((line) => lines.push(line));
        lines.push("```");
      }
      if (r.aiAnalysis) {
        lines.push(``);
        lines.push(`**AI Root Cause Analysis:**`);
        lines.push(``);
        lines.push(`- Severity: \`${r.aiAnalysis.severity.toUpperCase()}\``);
        lines.push(`- Category: ${r.aiAnalysis.category}`);
        lines.push(`- Root Cause: ${r.aiAnalysis.rootCause}`);
        lines.push(`- Suggestion: ${r.aiAnalysis.suggestion}`);
      }
      lines.push(``);
    });

    lines.push(`## Full Activity Trace`);
    lines.push(``);
    lines.push("```");
    this.entries.forEach((entry) => {
      const ts = new Date(entry.timestamp).toLocaleTimeString("pt-BR");
      const detail = entry.detail ? ` → ${entry.detail}` : "";
      lines.push(`[${ts}] [${entry.step.padEnd(12)}] ${entry.message}${detail}`);
    });
    lines.push("```");
    lines.push(``);

    lines.push(`## Artifacts`);
    lines.push(``);
    lines.push(`- **JSON Report:** ${report.artifacts.reportJsonPath}`);
    lines.push(`- **HTML Report:** ${report.artifacts.reportHtmlPath}`);
    lines.push(`- **Activity Log:** ${logFilePath}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(`*ROVIS AI Testing Engine — Powered by Google Gemini + Playwright*`);

    fs.writeFileSync(logFilePath, lines.join("\n"), "utf-8");
    console.log(`[activityLogger] Activity log written: ${logFilePath}`);
  }
}
