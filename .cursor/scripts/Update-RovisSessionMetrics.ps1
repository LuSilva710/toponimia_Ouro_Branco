# Update-RovisSessionMetrics.ps1
# Atualiza .cursor/memory/13-session-metrics.md com telemetria do AI-TESTING.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Source,
    [int]$QualityScore = -1,
    [bool]$Regression = $false,
    [int]$Flaky = 0,
    [string]$MetricsPath = ".cursor/memory/13-session-metrics.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MetricsPath)) {
    Write-Host "[METRICS] Arquivo inexistente: $MetricsPath"
    exit 1
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$entry = "- $timestamp | source=$Source | qualityScore=$QualityScore | regression=$Regression | flaky=$Flaky"

Add-Content -Path $MetricsPath -Value $entry -Encoding UTF8
Write-Host "[METRICS] Adicionado: $entry"
