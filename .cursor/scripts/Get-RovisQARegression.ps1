# Get-RovisQARegression.ps1
# Compara o ultimo report com o anterior e gera regression-report.json.

[CmdletBinding()]
param(
    [string]$HistoryPath = ".cursor/testing-module/reports/history/ai-run-history.jsonl",
    [string]$OutputPath = ".cursor/testing-module/reports/regression-report.json",
    [int]$WarnThreshold = -10,
    [int]$BlockThreshold = -20
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $HistoryPath)) {
    Write-Host "[QA-REGRESSION] Sem history.jsonl - primeira run"
    exit 0
}

$lines = Get-Content $HistoryPath -Tail 2
if ($lines.Count -lt 2) {
    Write-Host "[QA-REGRESSION] Necessario >= 2 runs"
    exit 0
}

$previous = $lines[0] | ConvertFrom-Json
$current  = $lines[1] | ConvertFrom-Json

$delta = [int]$current.qualityScore - [int]$previous.qualityScore
$severity = "ok"
$blocked = $false

if ($delta -le $BlockThreshold) {
    $severity = "block"
    $blocked = $true
}
elseif ($delta -le $WarnThreshold) {
    $severity = "warn"
}
elseif ($delta -lt 0) {
    $severity = "info"
}

$prevCases = @{}
foreach ($c in $previous.cases) { $prevCases[$c.id] = $c.status }
$newFails = @()
$recovered = @()
foreach ($c in $current.cases) {
    $prevStatus = $prevCases[$c.id]
    if ($c.status -eq "failed" -and $prevStatus -eq "passed") { $newFails += $c.id }
    if ($c.status -eq "passed" -and $prevStatus -eq "failed") { $recovered += $c.id }
}

$report = [ordered]@{
    generatedAt        = (Get-Date).ToString("o")
    previousScore      = $previous.qualityScore
    currentScore       = $current.qualityScore
    delta              = $delta
    severity           = $severity
    regressionDetected = ($delta -lt 0)
    blocked            = $blocked
    newFailures        = $newFails
    recoveredCases     = $recovered
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$report | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[QA-REGRESSION] delta=$delta severity=$severity blocked=$blocked"
Write-Host "[QA-REGRESSION] Relatorio: $OutputPath"

if ($blocked) { exit 2 }
exit 0
