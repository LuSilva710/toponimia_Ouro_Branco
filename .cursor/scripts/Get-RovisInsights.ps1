# Get-RovisInsights.ps1
# Le 13-session-metrics.md, identifica padroes recorrentes e gera insights.

[CmdletBinding()]
param(
    [string]$MetricsPath = ".cursor/memory/13-session-metrics.md",
    [int]$Window         = 50
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MetricsPath)) {
    Write-Host "[INSIGHTS] Sem metrics file: $MetricsPath"
    exit 0
}

$entries = Get-Content $MetricsPath | Where-Object { $_ -match "^- \d{4}-\d{2}-\d{2}" }
if ($entries.Count -eq 0) {
    Write-Host "[INSIGHTS] Nenhuma entrada registrada"
    exit 0
}

$tail = $entries | Select-Object -Last $Window

$bySource    = @{}
$byHour      = @{}
$qaScores    = New-Object System.Collections.Generic.List[int]
$regressions = 0
$flakyTotal  = 0

foreach ($l in $tail) {
    if ($l -match "source=([^\s|]+)") {
        $s = $matches[1]
        if (-not $bySource.ContainsKey($s)) { $bySource[$s] = 0 }
        $bySource[$s]++
    }
    if ($l -match "^\- (\d{4}-\d{2}-\d{2}) (\d{2}):") {
        $h = $matches[2]
        if (-not $byHour.ContainsKey($h)) { $byHour[$h] = 0 }
        $byHour[$h]++
    }
    if ($l -match "qualityScore=(-?\d+)") {
        $sc = [int]$matches[1]
        if ($sc -ge 0) { $qaScores.Add($sc) }
    }
    if ($l -match "regression=True") { $regressions++ }
    if ($l -match "flaky=(\d+)")     { $flakyTotal += [int]$matches[1] }
}

Write-Host ""
Write-Host "[INSIGHTS] Janela: $($tail.Count) de $($entries.Count) entradas"
Write-Host ("-" * 70)

if ($bySource.Count -gt 0) {
    Write-Host "[ATIVIDADE POR SOURCE]"
    $bySource.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 5 | ForEach-Object {
        Write-Host ("  {0,-20} {1}" -f $_.Key, $_.Value)
    }

    $top = ($bySource.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1)
    if ($top.Value -ge 5) {
        Write-Host "  >> insight: '$($top.Key)' domina ($($top.Value) execucoes) - considere automatizar."
    }
}

if ($qaScores.Count -ge 3) {
    Write-Host ""
    Write-Host "[QA SCORE]"
    $avg = [math]::Round(($qaScores | Measure-Object -Average).Average, 1)
    $min = ($qaScores | Measure-Object -Minimum).Minimum
    $max = ($qaScores | Measure-Object -Maximum).Maximum
    Write-Host "  avg=$avg  min=$min  max=$max  runs=$($qaScores.Count)"
    if ($avg -lt 60) { Write-Host "  >> insight: avg < 60 - quality consistentemente baixa, revisar contratos/casos." }
    if ($regressions -ge 3) { Write-Host "  >> insight: $regressions regressoes na janela - cobertura insuficiente?" }
    if ($flakyTotal -ge 5) { Write-Host "  >> insight: $flakyTotal casos flaky acumulados - revisar timing/race." }
}

if ($byHour.Count -gt 0) {
    Write-Host ""
    Write-Host "[ATIVIDADE POR HORA]"
    $byHour.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 3 | ForEach-Object {
        Write-Host ("  {0}:00  {1} entradas" -f $_.Key, $_.Value)
    }
}

Write-Host ("-" * 70)
