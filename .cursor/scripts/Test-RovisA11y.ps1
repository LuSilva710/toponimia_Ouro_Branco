# Test-RovisA11y.ps1
# Estrutura execucao de a11y (axe-core) via chrome-devtools MCP.
# A execucao real do axe e feita pelo agente FE_EXECUTOR. Este script prepara o report.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Url,
    [string]$BudgetPath  = ".cursor/governance/frontend-budget.json",
    [string]$ReportDir   = ".cursor/testing-module/reports/fe/a11y",
    [string]$PageName    = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BudgetPath)) {
    Write-Host "[A11Y] Budget ausente: $BudgetPath"
    exit 1
}
$budget = (Get-Content $BudgetPath -Raw | ConvertFrom-Json).a11y

if (-not (Test-Path $ReportDir)) { New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null }
if (-not $PageName) {
    $PageName = ($Url -replace "[^a-zA-Z0-9]", "-").Trim("-")
    if ($PageName.Length -gt 60) { $PageName = $PageName.Substring(0, 60) }
}

$reportFile = Join-Path $ReportDir "$PageName-a11y.json"

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    url         = $Url
    pageName    = $PageName
    wcagLevel   = $budget.wcagLevel
    budget      = $budget
    violations  = @{
        critical = $null
        serious  = $null
        moderate = $null
        minor    = $null
    }
    blocked      = $false
    status       = "pending-mcp-execution"
    instructions = "FE_EXECUTOR via chrome-devtools MCP: 1) abrir Url 2) injetar axe-core 3) preencher violations.{critical,serious,moderate,minor} 4) chamar este script com -PostExec se desejar avaliacao"
}

$report | ConvertTo-Json -Depth 6 | Set-Content -Path $reportFile -Encoding UTF8

Write-Host "[A11Y] Url: $Url"
Write-Host "[A11Y] WCAG: $($budget.wcagLevel) | maxCritical=$($budget.maxCritical) maxSerious=$($budget.maxSerious)"
Write-Host "[A11Y] Relatorio: $reportFile"
Write-Host "[A11Y] Aguardando execucao via FE_EXECUTOR + chrome-devtools MCP (axe-core)"
