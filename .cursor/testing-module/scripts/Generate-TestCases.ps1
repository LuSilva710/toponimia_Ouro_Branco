param(
  [Parameter(Mandatory = $true)]
  [string]$TargetsPath,

  [Parameter(Mandatory = $false)]
  [string]$OutputPath = ".cursor/testing-module/reports/generated-cases.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TargetsPath)) {
  throw "Targets file not found: $TargetsPath"
}

function Get-Array {
  param([object]$Value)

  if ($null -eq $Value) { return @() }
  return @($Value)
}

$targets = Get-Content $TargetsPath -Raw -Encoding utf8 | ConvertFrom-Json
$cases = @()
$script:nextId = 0
$maxCasesPerTarget = if ($targets.generation.maxCasesPerTarget) { [int]$targets.generation.maxCasesPerTarget } else { 20 }
$strategy = if ($targets.generation.strategy) { [string]$targets.generation.strategy } else { "hybrid" }
$contractsPath = if ($targets.generation.contractsPath) { [string]$targets.generation.contractsPath } else { ".cursor/contracts" }
$fuzzEnabled = if ($null -ne $targets.generation.fuzz.enabled) { [bool]$targets.generation.fuzz.enabled } else { $true }
$fuzzIterations = if ($targets.generation.fuzz.iterations) { [int]$targets.generation.fuzz.iterations } else { 3 }
$contractBindings = Get-Array -Value $targets.generation.contractBindings

function New-Case {
  param(
    [string]$Type,
    [string]$Name,
    [hashtable]$Payload
  )

  $script:nextId++
  return [PSCustomObject]@{
    id = "TC-$($script:nextId.ToString('0000'))"
    type = $Type
    name = $Name
    payload = $Payload
  }
}

foreach ($item in (Get-Array -Value $targets.targets.backendMethods)) {
  $cases += (New-Case -Type "backend_method" -Name $item.name -Payload @{
    invoke = $item.invoke
    expectedContains = $item.expectedContains
    source = "targets.backendMethods"
  })
}

foreach ($item in (Get-Array -Value $targets.targets.frontendFlows)) {
  $cases += (New-Case -Type "frontend_flow" -Name $item.name -Payload @{
    route = $item.route
    invoke = $item.invoke
    expectedContains = $item.expectedContains
    source = "targets.frontendFlows"
  })
}

foreach ($item in (Get-Array -Value $targets.targets.fieldValidations)) {
  $cases += (New-Case -Type "field_validation" -Name "$($item.field)-$($item.rule)" -Payload @{
    field = $item.field
    rule = $item.rule
    validValue = $item.validValue
    invalidValue = $item.invalidValue
    assertion = "required_pair"
    source = "targets.fieldValidations"
  })
}

foreach ($item in (Get-Array -Value $targets.targets.maskValidations)) {
  $cases += (New-Case -Type "mask_validation" -Name "$($item.field)-mask" -Payload @{
    field = $item.field
    maskPattern = $item.maskPattern
    validSamples = $item.validSamples
    invalidSamples = $item.invalidSamples
    source = "targets.maskValidations"
  })
}

$contractFilesUsed = @()
if ($strategy -eq "contract-first" -or $strategy -eq "hybrid") {
  if (Test-Path $contractsPath) {
    $contractFiles = Get-ChildItem -File -Path $contractsPath -Filter *.contract.json

    foreach ($contractFile in $contractFiles) {
      $contract = Get-Content $contractFile.FullName -Raw -Encoding utf8 | ConvertFrom-Json
      $contractFilesUsed += $contractFile.FullName

      $binding = $contractBindings | Where-Object {
        $_.endpoint -eq $contract.endpoint -and $_.method -eq $contract.method
      } | Select-Object -First 1

      $cmd = if ($binding -and $binding.command) {
        [string]$binding.command
      }
      else {
        "Write-Output '$($contract.method) $($contract.endpoint) contract-smoke'"
      }

      $expected = if ($binding -and $binding.expectedContains) {
        [string]$binding.expectedContains
      }
      else {
        [string]$contract.endpoint
      }

      $cases += (New-Case -Type "backend_method" -Name "contract:$($contract.method) $($contract.endpoint)" -Payload @{
        invoke = @{ type = "command"; command = $cmd }
        expectedContains = $expected
        sourceContract = $contractFile.Name
        source = "contracts"
      })
    }
  }
}

$fuzzCases = @()
if ($fuzzEnabled) {
  foreach ($item in (Get-Array -Value $targets.targets.fieldValidations)) {
    if ($item.rule -eq "required") {
      for ($i = 1; $i -le $fuzzIterations; $i++) {
        $validText = "valid-$($item.field)-$i"
        $invalidText = if ($i % 2 -eq 0) { "" } else { "   " }

        $fuzzCases += (New-Case -Type "field_validation" -Name "$($item.field)-required-valid-fuzz-$i" -Payload @{
          field = $item.field
          rule = "required"
          validValue = $validText
          assertion = "required_valid"
          source = "fuzz"
        })

        $fuzzCases += (New-Case -Type "field_validation" -Name "$($item.field)-required-invalid-fuzz-$i" -Payload @{
          field = $item.field
          rule = "required"
          invalidValue = $invalidText
          assertion = "required_invalid"
          source = "fuzz"
        })
      }
    }
  }

  foreach ($item in (Get-Array -Value $targets.targets.maskValidations)) {
    $validSamples = Get-Array -Value $item.validSamples
    $invalidSamples = Get-Array -Value $item.invalidSamples
    $validBase = if ($validSamples.Count -gt 0) { [string]$validSamples[0] } else { "" }

    for ($i = 1; $i -le $fuzzIterations; $i++) {
      $invalidMutation = "$validBase$i"
      if ($validBase.Length -gt 0) {
        $invalidMutation = $validBase.Replace(".", "").Replace("-", "")
      }

      $fuzzCases += (New-Case -Type "mask_validation" -Name "$($item.field)-mask-fuzz-$i" -Payload @{
        field = $item.field
        maskPattern = $item.maskPattern
        validSamples = $validSamples
        invalidSamples = @($invalidMutation) + $invalidSamples
        source = "fuzz"
      })
    }
  }
}

$cases += $fuzzCases
if ($maxCasesPerTarget -gt 0 -and $cases.Count -gt $maxCasesPerTarget) {
  $cases = $cases | Select-Object -First $maxCasesPerTarget
}

$output = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString("o")
  strategy = $strategy
  contractsPath = $contractsPath
  contractFilesUsed = $contractFilesUsed
  fuzzEnabled = $fuzzEnabled
  fuzzIterations = $fuzzIterations
  total = $cases.Count
  cases = $cases
}

$folder = Split-Path -Path $OutputPath -Parent
if (-not [string]::IsNullOrWhiteSpace($folder)) {
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$output | ConvertTo-Json -Depth 12 | Set-Content -Path $OutputPath -Encoding utf8
Write-Output "Cases generated: $($cases.Count) -> $OutputPath"
