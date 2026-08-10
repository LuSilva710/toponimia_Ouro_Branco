# Get-RovisQAStatus.ps1
# Status rapido do AI-TESTING: score atual, run anterior, tendencia.

[CmdletBinding()]
param(
    [switch]$Diff,
    [string]$SummaryPath = ".cursor/testing-module/reports/history/ai-summary.json",
    [string]$HistoryPath = ".cursor/testing-module/reports/history/ai-run-history.jsonl"
)

$ErrorActionPreference = "Stop"

function Get-Band([int]$score) {
    if ($score -ge 85) { return "EXCELLENT" }
    if ($score -ge 70) { return "ACCEPTABLE" }
    if ($score -ge 50) { return "WARNING" }
    return "CRITICAL"
}

if (-not (Test-Path $SummaryPath)) {
    Write-Host "[QA-STATUS] Sem historico ainda: $SummaryPath"
    exit 0
}

$summary = Get-Content $SummaryPath -Raw | ConvertFrom-Json
$last = $summary.lastRun

Write-Host ""
Write-Host "[QA STATUS]"
Write-Host "  Total runs:          $($summary.totalRuns)"
Write-Host "  Success runs:        $($summary.successRuns)"
Write-Host "  Failed runs:         $($summary.failedRuns)"
Write-Host "  Avg quality score:   $($summary.avgQualityScore)"
Write-Host "  Avg pass rate:       $([math]::Round($summary.avgPassRate * 100, 1))%"
Write-Host ""
Write-Host "[ULTIMA RUN]"
Write-Host "  Timestamp:           $($last.timestamp)"
Write-Host "  Mode:                $($last.runMode)"
Write-Host "  Quality score:       $($last.qualityScore) [$($last.qualityBand.ToUpper())]"
Write-Host "  Cases:               $($last.passed) passed / $($last.failed) failed / $($last.skipped) skipped (total $($last.totalCases))"
Write-Host "  Pass rate:           $([math]::Round($last.passRate * 100, 1))%"
Write-Host "  Duration:            $([math]::Round($last.durationMs / 1000, 1))s"
Write-Host ""

if (-not $Diff) { exit 0 }

if (-not (Test-Path $HistoryPath)) {
    Write-Host "[QA-DIFF] Sem history.jsonl"
    exit 0
}

$lines = Get-Content $HistoryPath -Tail 5
if ($lines.Count -lt 2) {
    Write-Host "[QA-DIFF] Necessario >= 2 runs para diff"
    exit 0
}

$runs = $lines | ForEach-Object { $_ | ConvertFrom-Json }
$current = $runs[-1]
$previous = $runs[-2]

$delta = [int]$current.qualityScore - [int]$previous.qualityScore
$arrow = if ($delta -gt 0) { "UP" } elseif ($delta -lt 0) { "DOWN" } else { "==" }

Write-Host "[TENDENCIA]"
Write-Host "  Run anterior score:  $($previous.qualityScore) [$(Get-Band $previous.qualityScore)]"
Write-Host "  Run atual score:     $($current.qualityScore) [$(Get-Band $current.qualityScore)]"
Write-Host "  Delta:               $delta ($arrow)"

$regression = $false
$severity = "OK"
if ($delta -le -20) { $regression = $true; $severity = "BLOCK" }
elseif ($delta -le -10) { $regression = $true; $severity = "WARN" }
elseif ($delta -lt 0) { $severity = "WARN" }

Write-Host "  Regressao:           $regression"
Write-Host "  Severidade:          $severity"
Write-Host ""

$last5 = $runs | Select-Object -Last 5 | ForEach-Object { $_.qualityScore }
Write-Host "[ULTIMOS 5 SCORES] $($last5 -join ' -> ')"
