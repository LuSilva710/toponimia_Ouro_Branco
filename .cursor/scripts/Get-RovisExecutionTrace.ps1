# Get-RovisExecutionTrace.ps1
# Renderiza timeline da sessao a partir de 13-session-metrics.md (linha por linha).

[CmdletBinding()]
param(
    [string]$MetricsPath = ".cursor/memory/13-session-metrics.md",
    [int]$Last = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MetricsPath)) {
    Write-Host "[TRACE] Sem metrics file"
    exit 0
}

$lines = Get-Content $MetricsPath | Where-Object { $_ -match "^- \d{4}-\d{2}-\d{2}" }
$total = $lines.Count
if ($total -eq 0) {
    Write-Host "[TRACE] Sem entradas registradas"
    exit 0
}

$tail = $lines | Select-Object -Last $Last

Write-Host ""
Write-Host "[EXECUTION TRACE] Ultimas $($tail.Count) entradas (total: $total)"
Write-Host ("-" * 70)

foreach ($l in $tail) {
    $clean = $l -replace "^- ", ""
    Write-Host $clean
}

Write-Host ("-" * 70)

$bySource = @{}
foreach ($l in $tail) {
    if ($l -match "source=([^\s|]+)") {
        $src = $matches[1]
        if (-not $bySource.ContainsKey($src)) { $bySource[$src] = 0 }
        $bySource[$src]++
    }
}

if ($bySource.Count -gt 0) {
    Write-Host ""
    Write-Host "[POR SOURCE]"
    $bySource.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        Write-Host ("  {0,-20} {1}" -f $_.Key, $_.Value)
    }
}
