param(
  [Parameter(Mandatory = $false)]
  [string]$RepoRoot = ".",

  [Parameter(Mandatory = $false)]
  [string]$OutputPath = ".cursor/testing-module/config/testing-targets.real.json"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path $RepoRoot).Path

$packageJsonFiles = Get-ChildItem -Path $root -Recurse -Filter package.json -File -ErrorAction SilentlyContinue | Where-Object {
  $_.FullName -notmatch "node_modules"
}
$csprojFiles = Get-ChildItem -Path $root -Recurse -Filter *.csproj -File -ErrorAction SilentlyContinue

$backendMethods = @()
$frontendFlows = @()
$fieldValidations = @()
$maskValidations = @()
$notes = @()

foreach ($pkg in $packageJsonFiles) {
  $content = Get-Content $pkg.FullName -Raw -Encoding utf8 | ConvertFrom-Json
  $scripts = $content.scripts
  if ($scripts) {
    $scriptNames = @($scripts.PSObject.Properties.Name)

    if ($scriptNames -contains "test") {
      $backendMethods += [PSCustomObject]@{
        name = "npm-test:$($pkg.DirectoryName)"
        invoke = @{ type = "command"; command = "cd '$($pkg.DirectoryName)'; npm test -- --runInBand" }
        expectedContains = "pass"
      }
      $notes += "Node target detected in $($pkg.DirectoryName): script 'test'"
    }

    if ($scriptNames -contains "test:e2e" -or $scriptNames -contains "e2e") {
      $frontendFlows += [PSCustomObject]@{
        name = "npm-e2e:$($pkg.DirectoryName)"
        route = "/"
        invoke = @{ type = "command"; command = "cd '$($pkg.DirectoryName)'; npm run test:e2e" }
        expectedContains = "passed"
      }
      $notes += "Frontend/e2e target detected in $($pkg.DirectoryName)"
    }
  }
}

foreach ($csproj in $csprojFiles) {
  $projName = [System.IO.Path]::GetFileNameWithoutExtension($csproj.Name)
  if ($projName.ToLowerInvariant().Contains("test")) {
    $backendMethods += [PSCustomObject]@{
      name = "dotnet-test:$projName"
      invoke = @{ type = "command"; command = "dotnet test '$($csproj.FullName)' --nologo" }
      expectedContains = "Passed"
    }
    $notes += "Dotnet test project detected: $($csproj.FullName)"
  }
}

if ($backendMethods.Count -eq 0 -and $frontendFlows.Count -eq 0) {
  $notes += "No real test projects/scripts detected in current repository."
  $backendMethods += [PSCustomObject]@{
    name = "placeholder-backend"
    invoke = @{ type = "command"; command = "Write-Output 'replace with real backend test command'" }
    expectedContains = "replace"
  }
}

$fieldValidations += [PSCustomObject]@{
  field = "email"
  rule = "required"
  validValue = "qa@empresa.com"
  invalidValue = ""
}

$maskValidations += [PSCustomObject]@{
  field = "cpf"
  maskPattern = "^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$"
  validSamples = @("123.456.789-10")
  invalidSamples = @("12345678910")
}

$output = [PSCustomObject]@{
  pipelineContext = [PSCustomObject]@{
    buildId = "autodetect"
    commitSha = "dev"
    environment = "local"
  }
  scope = [PSCustomObject]@{
    backend = $true
    frontend = $true
    masks = $true
    validations = $true
  }
  targets = [PSCustomObject]@{
    backendMethods = $backendMethods
    frontendFlows = $frontendFlows
    fieldValidations = $fieldValidations
    maskValidations = $maskValidations
  }
  generation = [PSCustomObject]@{
    strategy = "hybrid"
    maxCasesPerTarget = 150
    contractsPath = ".cursor/contracts"
    fuzz = [PSCustomObject]@{
      enabled = $true
      iterations = 5
    }
    contractBindings = @()
  }
  metadata = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString("o")
    notes = $notes
  }
}

$dir = Split-Path -Path $OutputPath -Parent
if (-not [string]::IsNullOrWhiteSpace($dir)) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$output | ConvertTo-Json -Depth 12 | Set-Content -Path $OutputPath -Encoding utf8
Write-Output "Targets file generated: $OutputPath"
Write-Output "backendMethods=$($backendMethods.Count) frontendFlows=$($frontendFlows.Count)"
