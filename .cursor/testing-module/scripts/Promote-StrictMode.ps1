param(
  [Parameter(Mandatory = $false)]
  [string]$QualityGatesPath = ".cursor/testing-module/config/quality-gates.json",

  [Parameter(Mandatory = $false)]
  [string]$TargetsPath = ".cursor/testing-module/config/testing-targets.real.json"
)

$ErrorActionPreference = "Stop"

& powershell -ExecutionPolicy Bypass -File ".cursor/testing-module/scripts/Check-RealTargetsReadiness.ps1" -TargetsPath $TargetsPath
$readyCode = $LASTEXITCODE

if (-not (Test-Path $QualityGatesPath)) {
  throw "Quality gates file not found: $QualityGatesPath"
}

$gates = Get-Content $QualityGatesPath -Raw -Encoding utf8 | ConvertFrom-Json

if ($readyCode -eq 0) {
  $gates.minRealCommandCases = 1
  $gates.requireRealTargetsInCi = $true
  $status = "strict_enabled"
}
else {
  $gates.minRealCommandCases = 0
  $gates.requireRealTargetsInCi = $true
  $status = "strict_pending_real_targets"
}

$gates | ConvertTo-Json -Depth 6 | Set-Content $QualityGatesPath -Encoding utf8
Write-Output "gate_status=$status minRealCommandCases=$($gates.minRealCommandCases) requireRealTargetsInCi=$($gates.requireRealTargetsInCi)"
