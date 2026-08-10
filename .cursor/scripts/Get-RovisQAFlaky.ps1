# Get-RovisQAFlaky.ps1
# Analisa as ultimas N runs e marca casos que alternaram pass/fail >= MinFlips vezes.

[CmdletBinding()]
param(
    [string]$HistoryPath = ".cursor/testing-module/reports/history/ai-run-history.jsonl",
    [string]$OutputPath  = ".cursor/testing-module/reports/flaky-cases.json",
    [int]$Window = 5,
    [int]$MinFlips = 2
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $HistoryPath)) {
    Write-Host "[QA-FLAKY] Sem history.jsonl"
    exit 0
}

$runs = Get-Content $HistoryPath -Tail $Window | ForEach-Object { $_ | ConvertFrom-Json }
if ($runs.Count -lt 3) {
    Write-Host "[QA-FLAKY] Necessario >= 3 runs (atual: $($runs.Count))"
    exit 0
}

$caseHistory = @{}
foreach ($run in $runs) {
    foreach ($c in $run.cases) {
        if (-not $caseHistory.ContainsKey($c.id)) { $caseHistory[$c.id] = @() }
        $caseHistory[$c.id] += $c.status
    }
}

$flaky = @()
foreach ($id in $caseHistory.Keys) {
    $statuses = $caseHistory[$id]
    if ($statuses.Count -lt 3) { continue }
    $flips = 0
    for ($i = 1; $i -lt $statuses.Count; $i++) {
        if ($statuses[$i] -ne $statuses[$i - 1]) { $flips++ }
    }
    if ($flips -ge $MinFlips) {
        $flaky += [ordered]@{
            caseId   = $id
            flips    = $flips
            history  = $statuses
        }
    }
}

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    window      = $Window
    minFlips    = $MinFlips
    totalCases  = $caseHistory.Count
    flakyCount  = $flaky.Count
    flaky       = $flaky
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$report | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[QA-FLAKY] $($flaky.Count) caso(s) flaky em janela de $Window runs"
Write-Host "[QA-FLAKY] Relatorio: $OutputPath"
