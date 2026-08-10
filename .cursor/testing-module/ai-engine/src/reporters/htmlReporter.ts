import fs from "fs";
import path from "path";
import type { QualityReport, TestResult } from "../types/index.js";

export function writeHtmlReport(report: QualityReport, filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const html = buildHtml(report);
  fs.writeFileSync(filePath, html, "utf-8");
  console.log(`[htmlReporter] HTML report written: ${filePath}`);
}

function buildHtml(report: QualityReport): string {
  const { summary, qualityScore, results, aiInsights } = report;
  const scoreColor = getScoreColor(qualityScore.total);
  const bandLabel = qualityScore.band.charAt(0).toUpperCase() + qualityScore.band.slice(1);
  const generatedAt = new Date(report.generatedAt).toLocaleString("pt-BR");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ROVIS AI Testing Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f13; color: #e2e8f0; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 2rem; border-bottom: 1px solid #2d3748; }
    .header h1 { font-size: 1.8rem; font-weight: 700; color: #63b3ed; letter-spacing: 0.02em; }
    .header .subtitle { color: #a0aec0; margin-top: 0.25rem; font-size: 0.9rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .score-section { display: flex; align-items: center; gap: 2rem; margin: 2rem 0; background: #1a202c; border-radius: 1rem; padding: 2rem; border: 1px solid #2d3748; }
    .score-gauge { position: relative; width: 140px; height: 140px; flex-shrink: 0; }
    .score-gauge svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .score-gauge .track { fill: none; stroke: #2d3748; stroke-width: 12; }
    .score-gauge .fill { fill: none; stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset 1s ease; }
    .score-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
    .score-number { font-size: 2rem; font-weight: 800; line-height: 1; }
    .score-label { font-size: 0.65rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; }
    .score-info h2 { font-size: 1.4rem; font-weight: 700; }
    .score-info .band { font-size: 0.85rem; color: #718096; margin-top: 0.25rem; }
    .breakdown { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-top: 1rem; }
    .breakdown-item { background: #2d3748; border-radius: 0.5rem; padding: 0.6rem 0.8rem; }
    .breakdown-item .label { font-size: 0.72rem; color: #a0aec0; text-transform: uppercase; }
    .breakdown-item .value { font-size: 1rem; font-weight: 600; margin-top: 0.15rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .stat-card { background: #1a202c; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #2d3748; text-align: center; }
    .stat-card .stat-value { font-size: 2.2rem; font-weight: 800; line-height: 1; }
    .stat-card .stat-label { font-size: 0.8rem; color: #718096; margin-top: 0.4rem; text-transform: uppercase; }
    .passed { color: #68d391; }
    .failed { color: #fc8181; }
    .skipped { color: #f6ad55; }
    .error { color: #f687b3; }
    .neutral { color: #63b3ed; }
    .insights { background: #1a202c; border-radius: 0.75rem; padding: 1.5rem; margin: 1.5rem 0; border-left: 4px solid #63b3ed; }
    .insights h3 { color: #63b3ed; font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
    .insights ul { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
    .insights li { font-size: 0.88rem; color: #cbd5e0; padding-left: 1rem; position: relative; }
    .insights li::before { content: "▸"; position: absolute; left: 0; color: #63b3ed; }
    .section-title { font-size: 1.1rem; font-weight: 600; margin: 2rem 0 1rem; color: #e2e8f0; display: flex; align-items: center; gap: 0.5rem; }
    .results-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .result-card { background: #1a202c; border-radius: 0.75rem; border: 1px solid #2d3748; overflow: hidden; }
    .result-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.25rem; cursor: pointer; user-select: none; }
    .result-header:hover { background: #2d3748; }
    .status-badge { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-passed { background: #22543d; color: #68d391; }
    .badge-failed { background: #742a2a; color: #fc8181; }
    .badge-skipped { background: #744210; color: #f6ad55; }
    .badge-error { background: #553c9a; color: #f687b3; }
    .result-name { flex: 1; font-size: 0.9rem; font-weight: 500; }
    .result-type { font-size: 0.72rem; color: #718096; padding: 0.15rem 0.5rem; background: #2d3748; border-radius: 0.25rem; }
    .result-duration { font-size: 0.75rem; color: #718096; }
    .result-confidence { font-size: 0.75rem; color: #a0aec0; }
    .result-body { padding: 0 1.25rem 1.25rem; display: none; }
    .result-body.open { display: block; }
    .result-row { display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.82rem; }
    .result-row .row-label { color: #718096; font-weight: 600; }
    .result-row .row-value { color: #e2e8f0; word-break: break-all; }
    .log-list { margin-top: 0.5rem; background: #0f0f13; border-radius: 0.5rem; padding: 0.75rem 1rem; max-height: 200px; overflow-y: auto; }
    .log-line { font-size: 0.78rem; font-family: 'Consolas', monospace; color: #a0aec0; line-height: 1.6; }
    .log-line.fail { color: #fc8181; }
    .ai-analysis { margin-top: 0.75rem; background: #1e2d4a; border-radius: 0.5rem; padding: 0.75rem 1rem; border-left: 3px solid #63b3ed; }
    .ai-analysis h4 { font-size: 0.8rem; color: #63b3ed; margin-bottom: 0.4rem; }
    .ai-badge { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700; margin-right: 0.4rem; }
    .sev-critical { background: #742a2a; color: #fc8181; }
    .sev-high { background: #744210; color: #f6ad55; }
    .sev-medium { background: #553c9a; color: #d6bcfa; }
    .sev-low { background: #1a365d; color: #63b3ed; }
    .footer { text-align: center; padding: 2rem; color: #4a5568; font-size: 0.8rem; border-top: 1px solid #2d3748; margin-top: 3rem; }
    .toggle-icon { font-size: 0.7rem; color: #4a5568; transition: transform 0.2s; }
    .open .toggle-icon { transform: rotate(180deg); }
  </style>
</head>
<body>
  <div class="header">
    <h1>ROVIS AI Testing Engine</h1>
    <div class="subtitle">Generated at ${generatedAt} | Mode: ${report.runMode} | Target: ${report.targetBaseUrl || "N/A"}</div>
  </div>

  <div class="container">
    ${buildScoreSection(qualityScore, scoreColor, bandLabel)}
    ${buildStatsGrid(summary)}
    ${buildInsightsSection(aiInsights)}
    <div class="section-title">Test Results (${results.length})</div>
    <div class="results-list">
      ${results.map((r) => buildResultCard(r)).join("\n")}
    </div>
  </div>

  <div class="footer">
    ROVIS AI Testing Engine &bull; Powered by Google Gemini &bull; Playwright &bull; TypeScript
  </div>

  <script>
    document.querySelectorAll('.result-header').forEach(function(header) {
      header.addEventListener('click', function() {
        var card = this.closest('.result-card');
        var body = card.querySelector('.result-body');
        body.classList.toggle('open');
        this.classList.toggle('open');
      });
    });
  </script>
</body>
</html>`;
}

function buildScoreSection(
  qualityScore: QualityReport["qualityScore"],
  scoreColor: string,
  bandLabel: string
): string {
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - qualityScore.total / 100);
  const bd = qualityScore.breakdown;

  return `
    <div class="score-section">
      <div class="score-gauge">
        <svg viewBox="0 0 120 120">
          <circle class="track" cx="60" cy="60" r="54"/>
          <circle class="fill" cx="60" cy="60" r="54"
            stroke="${scoreColor}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"/>
        </svg>
        <div class="score-center">
          <div class="score-number" style="color:${scoreColor}">${qualityScore.total}</div>
          <div class="score-label">/ 100</div>
        </div>
      </div>
      <div class="score-info">
        <h2>Quality Score</h2>
        <div class="band" style="color:${scoreColor}">${bandLabel}</div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="label">Pass Rate</div>
            <div class="value">${bd.passRateScore}<span style="color:#4a5568;font-size:0.75rem">/50</span></div>
          </div>
          <div class="breakdown-item">
            <div class="label">AI Confidence</div>
            <div class="value">${bd.aiConfidenceScore}<span style="color:#4a5568;font-size:0.75rem">/20</span></div>
          </div>
          <div class="breakdown-item">
            <div class="label">Real Cases</div>
            <div class="value">${bd.realCasesScore}<span style="color:#4a5568;font-size:0.75rem">/20</span></div>
          </div>
          <div class="breakdown-item">
            <div class="label">Coverage</div>
            <div class="value">${bd.coverageBreadthScore}<span style="color:#4a5568;font-size:0.75rem">/10</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildStatsGrid(summary: QualityReport["summary"]): string {
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value neutral">${summary.totalCases}</div>
        <div class="stat-label">Total Cases</div>
      </div>
      <div class="stat-card">
        <div class="stat-value passed">${summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value failed">${summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value skipped">${summary.skipped}</div>
        <div class="stat-label">Skipped</div>
      </div>
      <div class="stat-card">
        <div class="stat-value error">${summary.errored}</div>
        <div class="stat-label">Errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value neutral">${Math.round(summary.passRate * 100)}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value neutral">${(summary.durationMs / 1000).toFixed(1)}s</div>
        <div class="stat-label">Duration</div>
      </div>
    </div>`;
}

function buildInsightsSection(insights: string[]): string {
  if (insights.length === 0) return "";
  return `
    <div class="insights">
      <h3>AI Insights</h3>
      <ul>
        ${insights.map((i) => `<li>${escapeHtml(i)}</li>`).join("\n")}
      </ul>
    </div>`;
}

function buildResultCard(result: TestResult): string {
  const badgeClass = `badge-${result.status}`;
  const statusLabel = result.status.toUpperCase();
  const confidence = Math.round(result.aiConfidence * 100);

  const logs = result.evidence.logs || [];
  const logLines = logs
    .map((l) => {
      const isFail = l.startsWith("FAIL") || l.startsWith("[FAILED") || l.startsWith("[REQUEST_ERROR");
      return `<div class="log-line ${isFail ? "fail" : ""}">${escapeHtml(l)}</div>`;
    })
    .join("");

  const aiAnalysisHtml = result.aiAnalysis
    ? `
    <div class="ai-analysis">
      <h4>AI Root Cause Analysis</h4>
      <div>
        <span class="ai-badge sev-${result.aiAnalysis.severity}">${result.aiAnalysis.severity.toUpperCase()}</span>
        <span style="font-size:0.8rem;color:#a0aec0">${result.aiAnalysis.category}</span>
      </div>
      <div style="margin-top:0.4rem;font-size:0.83rem;color:#e2e8f0">${escapeHtml(result.aiAnalysis.rootCause)}</div>
      <div style="margin-top:0.4rem;font-size:0.78rem;color:#68d391">Suggestion: ${escapeHtml(result.aiAnalysis.suggestion)}</div>
    </div>`
    : "";

  return `
    <div class="result-card">
      <div class="result-header">
        <span class="status-badge ${badgeClass}">${statusLabel}</span>
        <span class="result-name">${escapeHtml(result.name)}</span>
        <span class="result-type">${result.type}</span>
        <span class="result-confidence">AI: ${confidence}%</span>
        <span class="result-duration">${result.durationMs}ms</span>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="result-body">
        <div class="result-row">
          <span class="row-label">Expected</span>
          <span class="row-value">${escapeHtml(result.expected)}</span>
        </div>
        <div class="result-row">
          <span class="row-label">Actual</span>
          <span class="row-value">${escapeHtml(result.actual)}</span>
        </div>
        ${result.evidence.screenshotPath ? `<div class="result-row"><span class="row-label">Screenshot</span><span class="row-value">${escapeHtml(result.evidence.screenshotPath)}</span></div>` : ""}
        ${result.evidence.tracePath ? `<div class="result-row"><span class="row-label">Trace</span><span class="row-value">${escapeHtml(result.evidence.tracePath)}</span></div>` : ""}
        ${logs.length > 0 ? `<div class="log-list">${logLines}</div>` : ""}
        ${aiAnalysisHtml}
      </div>
    </div>`;
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#68d391";
  if (score >= 70) return "#63b3ed";
  if (score >= 50) return "#f6ad55";
  return "#fc8181";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
