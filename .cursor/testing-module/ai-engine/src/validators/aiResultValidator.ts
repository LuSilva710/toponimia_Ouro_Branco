import { generateJson, generateText } from "../config/aiProvider.js";
import type { TestResult, AiFailureAnalysis } from "../types/index.js";

interface FailureAnalysisBatch {
  analyses: Array<{
    id: string;
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
  }>;
  overallInsights: string[];
}

export async function analyzeFailures(
  results: TestResult[]
): Promise<{ enrichedResults: TestResult[]; insights: string[] }> {
  const failures = results.filter(
    (r) => r.status === "failed" || r.status === "error"
  );

  if (failures.length === 0) {
    const passCount = results.filter((r) => r.status === "passed").length;
    const insights = [
      `All ${passCount} executed tests passed - no failures detected.`,
      "AI analysis: System appears healthy based on current test coverage.",
      "Recommendation: Increase test coverage for edge cases and error scenarios.",
    ];
    return { enrichedResults: results, insights };
  }

  console.log(
    `[aiResultValidator] Analyzing ${failures.length} failure(s) with configured AI provider...`
  );

  const failureSummaries = failures.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    expected: r.expected,
    actual: r.actual,
    logs: r.evidence.logs.slice(-5),
    errorMessage: r.evidence.errorMessage,
  }));

  const prompt = `You are a senior QA engineer analyzing automated test failures. Provide root cause analysis for each failure.

TEST FAILURES:
${JSON.stringify(failureSummaries, null, 2)}

For each failure, analyze:
1. What is the most likely root cause?
2. How severe is it (low/medium/high/critical)?
3. What category does it fall into (regression/configuration/data/environment/flaky/unknown)?
4. What is the recommended fix?

Also provide 3-5 overall insights about the test run quality.

Return this exact JSON structure:
{
  "analyses": [
    {
      "id": "test-case-id",
      "rootCause": "Clear explanation of why this test failed",
      "severity": "low|medium|high|critical",
      "suggestion": "Specific actionable recommendation to fix this",
      "category": "regression|configuration|data|environment|flaky|unknown"
    }
  ],
  "overallInsights": [
    "Insight about the overall test run quality",
    "Pattern observed across failures",
    "Recommendation for improving test reliability"
  ]
}

Severity guide:
- critical: Breaks core functionality, blocks users
- high: Major feature broken, significant user impact
- medium: Feature partially broken, workaround exists
- low: Minor issue, cosmetic or non-blocking`;

  try {
    const analysisResult = await generateJson<FailureAnalysisBatch>(prompt);

    const analysisMap = new Map<string, AiFailureAnalysis>();
    for (const analysis of analysisResult.analyses || []) {
      analysisMap.set(analysis.id, {
        rootCause: analysis.rootCause,
        severity: analysis.severity,
        suggestion: analysis.suggestion,
        category: analysis.category,
      });
    }

    const enrichedResults = results.map((result) => {
      if (
        (result.status === "failed" || result.status === "error") &&
        analysisMap.has(result.id)
      ) {
        return { ...result, aiAnalysis: analysisMap.get(result.id) };
      }
      return result;
    });

    const insights = analysisResult.overallInsights || [
      `${failures.length} test(s) failed - review root causes above.`,
    ];

    return { enrichedResults, insights };
  } catch (err) {
    console.error("[aiResultValidator] AI analysis failed:", err);

    const fallbackInsights = [
      `${failures.length} test(s) failed - AI analysis unavailable for the configured provider.`,
      "Manual review of test logs recommended.",
      ...failures.map(
        (f) => `- ${f.name}: ${f.actual.slice(0, 100)}`
      ),
    ];

    return { enrichedResults: results, insights: fallbackInsights };
  }
}

export async function generateQualitySummary(
  passed: number,
  failed: number,
  skipped: number,
  qualityScore: number
): Promise<string> {
  const total = passed + failed + skipped;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const prompt = `You are a QA quality analyst. Write a 2-3 sentence executive summary of this test run.

Results:
- Total cases: ${total}
- Passed: ${passed} (${passRate}%)
- Failed: ${failed}
- Skipped: ${skipped}
- Quality Score: ${qualityScore}/100

Write a concise, professional summary that a tech lead would read. Be specific about what the score means and whether the quality is acceptable.`;

  try {
    return await generateText(prompt);
  } catch {
    return `Test run completed: ${passed}/${total} tests passed (${passRate}% pass rate). Quality score: ${qualityScore}/100. ${failed > 0 ? `${failed} failure(s) require attention.` : "No failures detected."}`;
  }
}
