param(
  [Parameter(Mandatory = $false)]
  [string]$TargetsPath = "",

  [Parameter(Mandatory = $false)]
  [string]$CasesPath = ".cursor/testing-module/reports/generated-cases.json",

  [Parameter(Mandatory = $false)]
  [string]$ReportPath = ".cursor/testing-module/reports/final-report.json",

  [Parameter(Mandatory = $false)]
  [string]$QualityGatesPath = ".cursor/testing-module/config/quality-gates.json"
)

$ErrorActionPreference = "Stop"

function Test-IsMockCommand {
  param([string]$CommandText)

  if ([string]::IsNullOrWhiteSpace($CommandText)) { return $true }
  $normalized = $CommandText.ToLowerInvariant()
  return $normalized.Contains("write-output") -or $normalized.Contains("echo ")
}

$defaultTargets = ".cursor/testing-module/config/testing-targets.json"
$realTargets = ".cursor/testing-module/config/testing-targets.real.json"
$sampleTargets = ".cursor/testing-module/config/testing-targets.sample.json"
$preferRealTargets = ($env:PREFER_REAL_TARGETS -eq "true")
$targetsSource = "explicit"

if ([string]::IsNullOrWhiteSpace($TargetsPath)) {
  if ($preferRealTargets -and (Test-Path $realTargets)) {
    $TargetsPath = $realTargets
    $targetsSource = "auto-real"
  }
  elseif (Test-Path $defaultTargets) {
    $TargetsPath = $defaultTargets
    $targetsSource = "auto-default"
  }
  elseif (Test-Path $sampleTargets) {
    $TargetsPath = $sampleTargets
    $targetsSource = "auto-sample"
  }
  elseif (Test-Path $realTargets) {
    $TargetsPath = $realTargets
    $targetsSource = "fallback-real"
  }
  else {
    throw "Targets file not found. Checked: $realTargets, $defaultTargets, $sampleTargets"
  }
}
elseif (-not (Test-Path $TargetsPath)) {
  throw "Targets file not found: $TargetsPath"
}

$watch = [System.Diagnostics.Stopwatch]::StartNew()
& powershell -ExecutionPolicy Bypass -File ".cursor/testing-module/scripts/Generate-TestCases.ps1" -TargetsPath $TargetsPath -OutputPath $CasesPath

$casesRoot = Get-Content $CasesPath -Raw -Encoding utf8 | ConvertFrom-Json
$results = @()
$commandCases = 0
$realCommandCases = 0
$mockCommandCases = 0

function Invoke-CommandTarget {
  param([string]$CommandText)

  try {
    $output = Invoke-Expression $CommandText | Out-String
    return [PSCustomObject]@{ ok = $true; output = $output.Trim() }
  }
  catch {
    return [PSCustomObject]@{ ok = $false; output = $_.Exception.Message }
  }
}

foreach ($testCase in @($casesRoot.cases)) {
  $status = "passed"
  $expected = ""
  $actual = ""
  $logs = @()

  if ($testCase.type -eq "backend_method" -or $testCase.type -eq "frontend_flow") {
    $cmd = [string]$testCase.payload.invoke.command
    $expected = [string]$testCase.payload.expectedContains
    $exec = Invoke-CommandTarget -CommandText $cmd
    $actual = $exec.output
    $logs += "command: $cmd"

    $commandCases++
    if (Test-IsMockCommand -CommandText $cmd) {
      $mockCommandCases++
    }
    else {
      $realCommandCases++
    }

    if (-not $exec.ok -or ($expected -and ($actual -notlike "*$expected*"))) {
      $status = "failed"
    }
  }
  elseif ($testCase.type -eq "field_validation") {
    $rule = [string]$testCase.payload.rule
    $assertion = [string]$testCase.payload.assertion
    $validValue = [string]$testCase.payload.validValue
    $invalidValue = [string]$testCase.payload.invalidValue

    if ($rule -eq "required") {
      if ($assertion -eq "required_valid") {
        $expected = "value must be non-empty"
        $actual = "value='$validValue'"
        if ([string]::IsNullOrWhiteSpace($validValue)) { $status = "failed" }
      }
      elseif ($assertion -eq "required_invalid") {
        $expected = "value must be empty/whitespace"
        $actual = "value='$invalidValue'"
        if (-not [string]::IsNullOrWhiteSpace($invalidValue)) { $status = "failed" }
      }
      else {
        $expected = "valid non-empty and invalid empty"
        $actual = "valid='$validValue' invalid='$invalidValue'"
        if ([string]::IsNullOrWhiteSpace($validValue) -or -not [string]::IsNullOrWhiteSpace($invalidValue)) {
          $status = "failed"
        }
      }
    }
    else {
      $status = "skipped"
      $logs += "Unsupported rule for automatic check: $rule"
    }
  }
  elseif ($testCase.type -eq "mask_validation") {
    $pattern = [string]$testCase.payload.maskPattern
    $validSamples = @($testCase.payload.validSamples)
    $invalidSamples = @($testCase.payload.invalidSamples)
    $expected = "valid match and invalid non-match"
    $actual = "pattern='$pattern'"

    foreach ($sample in $validSamples) {
      if (-not ([string]$sample -match $pattern)) {
        $status = "failed"
        $logs += "Valid sample failed pattern: $sample"
      }
    }

    foreach ($sample in $invalidSamples) {
      if ([string]$sample -match $pattern) {
        $status = "failed"
        $logs += "Invalid sample matched pattern: $sample"
      }
    }
  }
  else {
    $status = "skipped"
    $logs += "Unknown case type: $($testCase.type)"
  }

  $results += [PSCustomObject]@{
    id = $testCase.id
    type = $testCase.type
    target = $testCase.name
    status = $status
    expected = $expected
    actual = $actual
    evidence = [PSCustomObject]@{
      logs = $logs
      screenshotPath = ""
      tracePath = ""
    }
  }
}

$total = $results.Count
$passed = @($results | Where-Object { $_.status -eq "passed" }).Count
$failed = @($results | Where-Object { $_.status -eq "failed" }).Count
$skipped = @($results | Where-Object { $_.status -eq "skipped" }).Count
$passRate = if ($total -gt 0) { [math]::Round($passed / $total, 4) } else { 0 }

$gates = [PSCustomObject]@{
  failOnFailed = $true
  maxFailed = 0
  maxSkipped = 0
  minPassRate = 1.0
  minTotalCases = 1
  minRealCommandCases = 0
  requireRealTargetsInCi = $false
}
if (Test-Path $QualityGatesPath) {
  $gates = Get-Content $QualityGatesPath -Raw -Encoding utf8 | ConvertFrom-Json
}
if ($null -eq $gates.minRealCommandCases) {
  $gates | Add-Member -NotePropertyName minRealCommandCases -NotePropertyValue 0 -Force
}
if ($null -eq $gates.requireRealTargetsInCi) {
  $gates | Add-Member -NotePropertyName requireRealTargetsInCi -NotePropertyValue $false -Force
}

$isCi = ($env:CI -eq "true" -or $env:GITHUB_ACTIONS -eq "true" -or $env:TF_BUILD -eq "True")

$gateViolations = @()
if ($gates.failOnFailed -and $failed -gt 0) {
  $gateViolations += "failOnFailed violated: failed=$failed"
}
if ($failed -gt [int]$gates.maxFailed) {
  $gateViolations += "maxFailed violated: failed=$failed maxFailed=$($gates.maxFailed)"
}
if ($skipped -gt [int]$gates.maxSkipped) {
  $gateViolations += "maxSkipped violated: skipped=$skipped maxSkipped=$($gates.maxSkipped)"
}
if ($passRate -lt [double]$gates.minPassRate) {
  $gateViolations += "minPassRate violated: passRate=$passRate minPassRate=$($gates.minPassRate)"
}
if ($total -lt [int]$gates.minTotalCases) {
  $gateViolations += "minTotalCases violated: total=$total minTotalCases=$($gates.minTotalCases)"
}
if ($realCommandCases -lt [int]$gates.minRealCommandCases) {
  $gateViolations += "minRealCommandCases violated: real=$realCommandCases minRealCommandCases=$($gates.minRealCommandCases)"
}
if ($gates.requireRealTargetsInCi -and $isCi -and $realCommandCases -le 0) {
  $gateViolations += "requireRealTargetsInCi violated: CI=true and realCommandCases=$realCommandCases"
}

$watch.Stop()
$gatesPassed = ($gateViolations.Count -eq 0)
$reportSuccess = ($failed -eq 0 -and $gatesPassed)

$historyDir = ".cursor/testing-module/reports/history"
$historyPath = "$historyDir/run-history.jsonl"
$summaryPath = "$historyDir/summary.json"
New-Item -ItemType Directory -Force -Path $historyDir | Out-Null

$runRecord = [PSCustomObject]@{
  timestamp = (Get-Date).ToString("o")
  targetsPath = $TargetsPath
  targetsSource = $targetsSource
  casesPath = $CasesPath
  reportPath = $ReportPath
  success = $reportSuccess
  totalCases = $total
  passed = $passed
  failed = $failed
  skipped = $skipped
  passRate = $passRate
  durationMs = $watch.ElapsedMilliseconds
  commandCases = $commandCases
  realCommandCases = $realCommandCases
  mockCommandCases = $mockCommandCases
  qualityGatesPassed = $gatesPassed
  isCi = $isCi
}

$runRecord | ConvertTo-Json -Compress | Add-Content -Path $historyPath -Encoding utf8

$historyLines = Get-Content $historyPath -Encoding utf8
$historyRecords = @()
foreach ($line in $historyLines) {
  if (-not [string]::IsNullOrWhiteSpace($line)) {
    $historyRecords += ($line | ConvertFrom-Json)
  }
}

$totalRuns = $historyRecords.Count
$failedRuns = @($historyRecords | Where-Object { -not $_.success }).Count
$avgPassRate = if ($totalRuns -gt 0) { [math]::Round((($historyRecords | Measure-Object -Property passRate -Average).Average), 4) } else { 0 }
$avgDurationMs = if ($totalRuns -gt 0) { [int][math]::Round((($historyRecords | Measure-Object -Property durationMs -Average).Average), 0) } else { 0 }

$summary = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString("o")
  totalRuns = $totalRuns
  failedRuns = $failedRuns
  successRuns = ($totalRuns - $failedRuns)
  avgPassRate = $avgPassRate
  avgDurationMs = $avgDurationMs
  lastRun = $runRecord
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding utf8

$report = [PSCustomObject]@{
  success = $reportSuccess
  summary = [PSCustomObject]@{
    totalCases = $total
    passed = $passed
    failed = $failed
    skipped = $skipped
    passRate = $passRate
    durationMs = $watch.ElapsedMilliseconds
  }
  qualityGates = [PSCustomObject]@{
    passed = $gatesPassed
    config = $gates
    violations = $gateViolations
  }
  observability = [PSCustomObject]@{
    targetsSource = $targetsSource
    isCi = $isCi
    commandCases = $commandCases
    realCommandCases = $realCommandCases
    mockCommandCases = $mockCommandCases
    historyPath = $historyPath
    historySummaryPath = $summaryPath
  }
  results = $results
  artifacts = [PSCustomObject]@{
    reportJsonPath = $ReportPath
    reportHtmlPath = ""
  }
}

$folder = Split-Path -Path $ReportPath -Parent
if (-not [string]::IsNullOrWhiteSpace($folder)) {
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$report | ConvertTo-Json -Depth 12 | Set-Content -Path $ReportPath -Encoding utf8
Write-Output "Module run finished. Passed=$passed Failed=$failed Skipped=$skipped PassRate=$passRate"
Write-Output "QualityGates passed=$gatesPassed"
Write-Output "Observability targetsSource=$targetsSource isCi=$isCi realCommandCases=$realCommandCases mockCommandCases=$mockCommandCases history=$historyPath"
Write-Output "Report: $ReportPath"

if (-not $reportSuccess) {
  exit 1
}

# ----------------------------------------------------------------
# Optional: AI Engine integration
# Set $env:USE_AI_ENGINE = "true" to run the AI Testing Engine
# after the standard module completes successfully.
# ----------------------------------------------------------------
$useAiEngine = ($env:USE_AI_ENGINE -eq "true")
if ($useAiEngine) {
  Write-Output ""
  Write-Output "USE_AI_ENGINE=true detected - launching AI Testing Engine..."
  $aiScript = ".cursor/testing-module/scripts/Run-AIEngine.ps1"

  if (Test-Path $aiScript) {
    & powershell -ExecutionPolicy Bypass -File $aiScript -SkipInstall:$false
    $aiExitCode = $LASTEXITCODE
    Write-Output "AI Engine finished with exit code $aiExitCode"

    if ($aiExitCode -ne 0) {
      Write-Output "AI Engine reported failures - see .cursor/testing-module/reports/ai-final-report.json"
    }
  }
  else {
    Write-Output "AI Engine script not found: $aiScript"
  }
}
