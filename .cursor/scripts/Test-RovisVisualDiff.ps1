# Test-RovisVisualDiff.ps1
# Orquestra captura e diff de screenshot via chrome-devtools MCP.
# Estrutura saida + relatorio. A captura real e feita pelo agente FE_EXECUTOR via MCP.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Url,
    [Parameter(Mandatory)]
    [string]$Name,
    [string]$Viewport = "desktop",
    [string]$BaselineDir = ".cursor/testing-module/reports/fe/visual/baseline",
    [string]$DiffDir     = ".cursor/testing-module/reports/fe/visual/diff",
    [string]$ReportPath  = ".cursor/testing-module/reports/fe/visual",
    [double]$MaxPercent  = 1.0
)

$ErrorActionPreference = "Stop"

foreach ($d in @($BaselineDir, $DiffDir, $ReportPath)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$baselinePath = Join-Path $BaselineDir "$Name-$Viewport.png"
$currentPath  = Join-Path $DiffDir     "$Name-$Viewport-current.png"
$diffPath     = Join-Path $DiffDir     "$Name-$Viewport-diff.png"
$reportFile   = Join-Path $ReportPath  "$Name-$Viewport-report.json"

$baselineExists = Test-Path $baselinePath
$mode = if ($baselineExists) { "compare" } else { "create-baseline" }

$report = [ordered]@{
    generatedAt   = (Get-Date).ToString("o")
    url           = $Url
    name          = $Name
    viewport      = $Viewport
    mode          = $mode
    baselinePath  = $baselinePath
    currentPath   = $currentPath
    diffPath      = $diffPath
    diffPercent   = $null
    maxPercent    = $MaxPercent
    status        = if ($baselineExists) { "pending-mcp-capture" } else { "baseline-needed" }
    instructions  = if ($baselineExists) {
        "FE_EXECUTOR via chrome-devtools MCP: 1) abrir Url 2) salvar screenshot em currentPath 3) gerar diff vs baseline em diffPath 4) preencher diffPercent neste arquivo"
    } else {
        "FE_EXECUTOR via chrome-devtools MCP: capturar screenshot em baselinePath (primeira execucao)"
    }
    blocked       = $false
}

$report | ConvertTo-Json -Depth 5 | Set-Content -Path $reportFile -Encoding UTF8

Write-Host "[VISUAL-DIFF] mode=$mode | name=$Name | viewport=$Viewport"
Write-Host "[VISUAL-DIFF] Relatorio: $reportFile"
Write-Host "[VISUAL-DIFF] Aguardando captura via FE_EXECUTOR + chrome-devtools MCP"
