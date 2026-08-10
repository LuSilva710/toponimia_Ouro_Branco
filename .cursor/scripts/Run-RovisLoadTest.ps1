# Run-RovisLoadTest.ps1
# Executa load test simples via autocannon (npx) ou fallback nativo.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Url,
    [int]$DurationSeconds = 15,
    [int]$Connections     = 10,
    [int]$P95ThresholdMs  = 500,
    [string]$OutputPath   = ".cursor/testing-module/reports/be/load-test.json"
)

$ErrorActionPreference = "Continue"

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$autocannonAvailable = $false
try {
    $null = & npx --no-install autocannon --help 2>$null
    if ($LASTEXITCODE -eq 0) { $autocannonAvailable = $true }
} catch {}

if ($autocannonAvailable) {
    Write-Host "[LOAD-TEST] autocannon disponivel - executando $DurationSeconds s, $Connections conexoes"
    $tmp = Join-Path $env:TEMP "rovis-load-$(Get-Random).json"
    & npx autocannon --json -d $DurationSeconds -c $Connections $Url > $tmp 2>$null
    $raw = Get-Content $tmp -Raw | ConvertFrom-Json
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue

    $p95 = [int]$raw.latency.p97_5
    $report = [ordered]@{
        generatedAt    = (Get-Date).ToString("o")
        tool           = "autocannon"
        url            = $Url
        durationS      = $DurationSeconds
        connections    = $Connections
        requests       = $raw.requests.total
        rps            = $raw.requests.average
        latencyAvg     = $raw.latency.average
        latencyP95     = $p95
        errors         = $raw.errors
        timeouts       = $raw.timeouts
        thresholdP95Ms = $P95ThresholdMs
        blocked        = ($p95 -gt $P95ThresholdMs)
    }
}
else {
    Write-Host "[LOAD-TEST] autocannon ausente - executando fallback simples"
    $count = 0; $errors = 0
    $latencies = New-Object System.Collections.Generic.List[double]
    $end = (Get-Date).AddSeconds([math]::Min($DurationSeconds, 10))
    while ((Get-Date) -lt $end) {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        try { $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop } catch { $errors++ }
        $sw.Stop()
        $latencies.Add($sw.Elapsed.TotalMilliseconds)
        $count++
    }
    $sorted = $latencies | Sort-Object
    $p95idx = [int][math]::Floor($sorted.Count * 0.95)
    $p95 = if ($sorted.Count -gt 0) { [int]$sorted[$p95idx] } else { 0 }
    $avg = if ($sorted.Count -gt 0) { [math]::Round(($sorted | Measure-Object -Average).Average, 1) } else { 0 }

    $report = [ordered]@{
        generatedAt    = (Get-Date).ToString("o")
        tool           = "powershell-fallback"
        url            = $Url
        durationS      = [math]::Min($DurationSeconds, 10)
        requests       = $count
        errors         = $errors
        latencyAvg     = $avg
        latencyP95     = $p95
        thresholdP95Ms = $P95ThresholdMs
        blocked        = ($p95 -gt $P95ThresholdMs)
    }
}

$report | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8
Write-Host "[LOAD-TEST] req=$($report.requests) p95=$($report.latencyP95)ms threshold=$($P95ThresholdMs)ms blocked=$($report.blocked)"
Write-Host "[LOAD-TEST] Relatorio: $OutputPath"
if ($report.blocked) { exit 2 }
