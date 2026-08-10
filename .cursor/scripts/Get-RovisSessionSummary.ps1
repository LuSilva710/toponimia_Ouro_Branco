param(
    [string]$Root = ".",
    [int]$LookbackDays = 1
)

$ErrorActionPreference = "Stop"

$memoryRoot = Join-Path $Root ".cursor/memory"

function Get-RecentEntries {
    param([string]$Path, [int]$Days)
    if (-not (Test-Path $Path)) { return @() }

    $cutoff = (Get-Date).AddDays(-$Days)
    $lines = Get-Content $Path -Encoding UTF8
    $entries = @()
    $current = $null
    $currentDate = $null

    foreach ($line in $lines) {
        if ($line -match "^##\s+(\d{4}-\d{2}-\d{2})") {
            if ($current -and $currentDate -ge $cutoff) {
                $entries += $current
            }
            $currentDate = [datetime]::ParseExact($matches[1], "yyyy-MM-dd", $null)
            $current = $line
        } elseif ($current) {
            $current += "`n" + $line
        }
    }
    if ($current -and $currentDate -ge $cutoff) {
        $entries += $current
    }
    return $entries
}

$sessionPath        = Join-Path $memoryRoot "11-session-summary.md"
$worksetPath        = Join-Path $memoryRoot "12-active-workset.md"
$checkpointPath     = Join-Path $memoryRoot "10-checkpoint.md"
$implementationPath = Join-Path $memoryRoot "06-implementation-log.md"
$testingPath        = Join-Path $memoryRoot "07-testing-log.md"
$donePath           = Join-Path $memoryRoot "09-done.md"
$metricsPath        = Join-Path $memoryRoot "13-session-metrics.md"

$implementations = Get-RecentEntries -Path $implementationPath -Days $LookbackDays
$tests           = Get-RecentEntries -Path $testingPath -Days $LookbackDays
$dones           = Get-RecentEntries -Path $donePath -Days $LookbackDays
$checkpoints     = Get-RecentEntries -Path $checkpointPath -Days $LookbackDays

$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Output ""
Write-Output "======================================================"
Write-Output "         ROVIS SESSION SUMMARY"
Write-Output "======================================================"
Write-Output ""
Write-Output "Gerado em: $now"
Write-Output "Janela: ultimos $LookbackDays dia(s)"
Write-Output ""

Write-Output "-- Implementacoes ($($implementations.Count)) --"
foreach ($e in $implementations) {
    $title = ($e -split "`n")[0] -replace "^##\s*", ""
    Write-Output "  - $title"
}
Write-Output ""

Write-Output "-- Validacoes ($($tests.Count)) --"
foreach ($e in $tests) {
    $title = ($e -split "`n")[0] -replace "^##\s*", ""
    Write-Output "  - $title"
}
Write-Output ""

Write-Output "-- Entregas concluidas ($($dones.Count)) --"
foreach ($e in $dones) {
    $title = ($e -split "`n")[0] -replace "^##\s*", ""
    Write-Output "  - $title"
}
Write-Output ""

Write-Output "-- Checkpoints registrados ($($checkpoints.Count)) --"
foreach ($e in $checkpoints) {
    $title = ($e -split "`n")[0] -replace "^##\s*", ""
    Write-Output "  - $title"
}
Write-Output ""

if (Test-Path $worksetPath) {
    $workset = Get-Content $worksetPath -Encoding UTF8 -Raw
    if ($workset -match "Objetivo atual:\s*\r?\n-\s*(.+)") {
        Write-Output "-- Objetivo atual --"
        Write-Output "  $($matches[1].Trim())"
        Write-Output ""
    }
}

if (Test-Path $metricsPath) {
    Write-Output "-- Session Metrics --"
    $metrics = Get-Content $metricsPath -Encoding UTF8
    foreach ($line in $metrics) {
        if ($line -match "^- (tasksCompleted|agentSwitches|failedChecks|approvalsRequested|approvalsGranted|loopsDetected):") {
            Write-Output "  $line"
        }
    }
    Write-Output ""
}

Write-Output "------------------------------------------------------"
Write-Output "  Total de eventos: $($implementations.Count + $tests.Count + $dones.Count + $checkpoints.Count)"
Write-Output ""
