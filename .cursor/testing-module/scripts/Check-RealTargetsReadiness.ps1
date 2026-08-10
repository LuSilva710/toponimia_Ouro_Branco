param(
  [Parameter(Mandatory = $false)]
  [string]$TargetsPath = ".cursor/testing-module/config/testing-targets.resolved.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TargetsPath)) {
  throw "Targets file not found: $TargetsPath"
}

$targets = Get-Content $TargetsPath -Raw -Encoding utf8 | ConvertFrom-Json
$commandItems = @($targets.targets.backendMethods) + @($targets.targets.frontendFlows)
$allCommands = @($commandItems | ForEach-Object { [string]$_.invoke.command })
$realCommands = @($allCommands | Where-Object {
  -not [string]::IsNullOrWhiteSpace($_) -and $_.ToLowerInvariant().Contains("write-output") -eq $false -and $_.ToLowerInvariant().Contains("echo ") -eq $false
})

$isReady = ($realCommands.Count -gt 0)

$result = [PSCustomObject]@{
  targetsPath = $TargetsPath
  totalCommandCases = $allCommands.Count
  realCommandCases = $realCommands.Count
  readyForStrictMode = $isReady
  sampleRealCommands = @($realCommands | Select-Object -First 5)
}

$result | ConvertTo-Json -Depth 6 | Set-Content ".cursor/testing-module/reports/real-target-readiness.json" -Encoding utf8
Write-Output ("readyForStrictMode={0} realCommandCases={1} totalCommandCases={2}" -f $isReady, $realCommands.Count, $allCommands.Count)
if (-not $isReady) { exit 2 }
