param(
  [Parameter(Mandatory = $false)]
  [ValidateSet("all", "api", "browser", "generate", "retry-failed")]
  [string]$Mode = "all",

  [Parameter(Mandatory = $false)]
  [ValidateSet("gemini", "openai", "codex", "")]
  [string]$Provider = "",

  [Parameter(Mandatory = $false)]
  [string]$TargetBaseUrl = "",

  [Parameter(Mandatory = $false)]
  [string]$TargetBrowserUrl = "",

  [Parameter(Mandatory = $false)]
  [string]$GeminiApiKey = "",

  [Parameter(Mandatory = $false)]
  [string]$OpenAIApiKey = "",

  [Parameter(Mandatory = $false)]
  [switch]$SkipInstall = $false,

  [Parameter(Mandatory = $false)]
  [switch]$SkipBrowserInstall = $false,

  # Mostra o browser visualmente durante os testes
  [Parameter(Mandatory = $false)]
  [switch]$Headed = $false,

  # Atraso entre cada acao do Playwright em ms (util para acompanhar visualmente)
  [Parameter(Mandatory = $false)]
  [int]$SlowMo = 1500,

  # Pausa extra em ms APOS cada passo do flow (alem do SlowMo)
  [Parameter(Mandatory = $false)]
  [int]$StepDelay = 1000
)

$ErrorActionPreference = "Stop"
$engineDir = ".cursor/testing-module/ai-engine"
$envFile = "$engineDir/.env"
$reportsDir = ".cursor/testing-module/reports"
$launchSettingsFile = "IFinc-BackEnd/IFinc.API/Properties/launchSettings.json"
$qaResolverScript = ".cursor/scripts/Resolve-RovisQATargets.ps1"
$runtimeTargetsResolverScript = ".cursor/scripts/Resolve-RovisRuntimeTargets.ps1"
$resolvedQaTargets = $null
$resolvedRuntimeTargets = $null

function Get-DefaultLocalApiUrl {
  param([string]$launchSettingsPath)

  $fallback = "http://localhost:3000"
  if (-not (Test-Path $launchSettingsPath)) { return $fallback }

  try {
    $launch = Get-Content $launchSettingsPath -Raw | ConvertFrom-Json
    $applicationUrl = $launch.iisSettings.iisExpress.applicationUrl
    if ([string]::IsNullOrWhiteSpace($applicationUrl)) { return $fallback }

    # launchSettings may contain multiple URLs separated by ';'
    $firstUrl = ($applicationUrl -split ";")[0].Trim()
    if ([string]::IsNullOrWhiteSpace($firstUrl)) { return $fallback }
    return $firstUrl
  }
  catch {
    return $fallback
  }
}

Write-Output ""
Write-Output "============================================================"
Write-Output "  ROVIS AI Testing Engine"
Write-Output "  Providers: Google Gemini | OpenAI / Codex CLI"
Write-Output "  MCP Servers: gemini, codex (.cursor/mcp.json)"
Write-Output "============================================================"
Write-Output ""
Write-Output "[MCP] Lembrete: use as ferramentas MCP 'gemini' ou 'codex'"
Write-Output "      no Cursor para gerar cenarios ANTES de executar."
Write-Output "      Veja: .cursor/agents/11-ai-testing.md"
Write-Output ""

if (Test-Path $runtimeTargetsResolverScript) {
  try {
    $resolvedRuntimeTargets = powershell -ExecutionPolicy Bypass -File $runtimeTargetsResolverScript | ConvertFrom-Json
  }
  catch {
    Write-Output "[warning] Runtime target resolver failed: $($_.Exception.Message)"
  }
}

if (Test-Path $qaResolverScript) {
  try {
    $resolvedQaTargets = powershell -ExecutionPolicy Bypass -File $qaResolverScript | ConvertFrom-Json
  }
  catch {
    Write-Output "[warning] QA target resolver failed: $($_.Exception.Message)"
  }
}

if (-not (Test-Path $engineDir)) {
  Write-Error "AI Engine directory not found: $engineDir"
  exit 1
}

# ----------------------------------------------------------------
# Load .env file (all keys)
# ----------------------------------------------------------------
$envValues = @{}
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^([^#=]+)=(.*)$") {
      $k = $Matches[1].Trim()
      $v = $Matches[2].Trim().Trim('"').Trim("'")
      $envValues[$k] = $v
      if (-not [string]::IsNullOrWhiteSpace($v) -and $v -notlike "your_*") {
        [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
      }
    }
  }
}

if ($null -ne $resolvedRuntimeTargets) {
  if ([string]::IsNullOrWhiteSpace($TargetBaseUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedRuntimeTargets.backendUrl)) {
    $env:TARGET_BASE_URL = $resolvedRuntimeTargets.backendUrl
    Write-Output "[config] TARGET_BASE_URL runtime-resolved = $($env:TARGET_BASE_URL)"
  }
  if ([string]::IsNullOrWhiteSpace($TargetBrowserUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedRuntimeTargets.frontendUrl)) {
    $env:TARGET_BROWSER_URL = $resolvedRuntimeTargets.frontendUrl
    Write-Output "[config] TARGET_BROWSER_URL runtime-resolved = $($env:TARGET_BROWSER_URL)"
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedRuntimeTargets.swaggerJsonUrl)) {
    $env:SWAGGER_JSON_URL = $resolvedRuntimeTargets.swaggerJsonUrl
    Write-Output "[config] SWAGGER_JSON_URL resolved = $($env:SWAGGER_JSON_URL)"
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedRuntimeTargets.swaggerUiUrl)) {
    $env:SWAGGER_UI_URL = $resolvedRuntimeTargets.swaggerUiUrl
    Write-Output "[config] SWAGGER_UI_URL resolved = $($env:SWAGGER_UI_URL)"
  }
}

if ($null -ne $resolvedQaTargets) {
  if (-not [string]::IsNullOrWhiteSpace($resolvedQaTargets.contractsPath)) {
    $env:CONTRACTS_PATH = (Resolve-Path $resolvedQaTargets.contractsPath).Path
    Write-Output "[config] CONTRACTS_PATH resolved = $($env:CONTRACTS_PATH)"
  }
  if ([string]::IsNullOrWhiteSpace($TargetBaseUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedQaTargets.backendUrl)) {
    $env:TARGET_BASE_URL = $resolvedQaTargets.backendUrl
    Write-Output "[config] TARGET_BASE_URL resolved = $($env:TARGET_BASE_URL)"
  }
  if ([string]::IsNullOrWhiteSpace($TargetBrowserUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedQaTargets.frontendUrl)) {
    $env:TARGET_BROWSER_URL = $resolvedQaTargets.frontendUrl
    Write-Output "[config] TARGET_BROWSER_URL resolved = $($env:TARGET_BROWSER_URL)"
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedQaTargets.resolvedFeaturesPath)) {
    $env:FEATURES_PATH = (Resolve-Path $resolvedQaTargets.resolvedFeaturesPath).Path
    Write-Output "[config] FEATURES_PATH resolved = $($env:FEATURES_PATH)"
  }
}

# ----------------------------------------------------------------
# Resolve AI_PROVIDER
# ----------------------------------------------------------------
if (-not [string]::IsNullOrWhiteSpace($Provider)) {
  $env:AI_PROVIDER = $Provider.ToLower()
}
elseif ([string]::IsNullOrWhiteSpace($env:AI_PROVIDER) -and $envValues.ContainsKey("AI_PROVIDER")) {
  $env:AI_PROVIDER = $envValues["AI_PROVIDER"]
}
if ([string]::IsNullOrWhiteSpace($env:AI_PROVIDER)) {
  $env:AI_PROVIDER = "codex"
}
$activeProvider = $env:AI_PROVIDER.ToLower()
Write-Output "[config] AI_PROVIDER = $activeProvider"

# ----------------------------------------------------------------
# Resolve API keys based on active provider
# ----------------------------------------------------------------
if ($activeProvider -eq "codex") {
  try {
    $null = Get-Command codex -ErrorAction Stop
    $model = if ($env:CODEX_MODEL) { $env:CODEX_MODEL } elseif ($env:OPENAI_MODEL) { $env:OPENAI_MODEL } else { "gpt-5.4-mini" }
    Write-Output "[config] Codex CLI model = $model"
  }
  catch {
    Write-Output ""
    Write-Output "ERROR: AI_PROVIDER=codex requires the 'codex' CLI in PATH."
    Write-Output "Install or expose Codex CLI before running the engine."
    Write-Output ""
    exit 1
  }
}
elseif ($activeProvider -eq "openai") {
  # ---- OpenAI ----
  if (-not [string]::IsNullOrWhiteSpace($OpenAIApiKey)) {
    $env:OPENAI_API_KEY = $OpenAIApiKey
    Write-Output "[config] OPENAI_API_KEY set from parameter"
  }
  elseif (-not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    Write-Output "[config] OPENAI_API_KEY found in environment"
  }

  if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    Write-Output ""
    Write-Output "ERROR: AI_PROVIDER=$activeProvider requires OPENAI_API_KEY."
    Write-Output "Options:"
    Write-Output "  1. Set OPENAI_API_KEY in $engineDir/.env"
    Write-Output "  2. Run: .\Run-AIEngine.ps1 -Provider openai -OpenAIApiKey 'sk-...'"
    Write-Output "  3. Set: `$env:OPENAI_API_KEY = 'sk-...'"
    Write-Output "  Get your key at: https://platform.openai.com/api-keys"
    Write-Output ""
    exit 1
  }
  $model = if ($env:OPENAI_MODEL) { $env:OPENAI_MODEL } else { "gpt-4o-mini" }
  Write-Output "[config] OpenAI model = $model"
}
else {
  # ---- Google Gemini ----
  if (-not [string]::IsNullOrWhiteSpace($GeminiApiKey)) {
    $env:GEMINI_API_KEY = $GeminiApiKey
    Write-Output "[config] GEMINI_API_KEY set from parameter"
  }
  elseif (-not [string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY)) {
    Write-Output "[config] GEMINI_API_KEY found in environment"
  }

  if ([string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY)) {
    Write-Output ""
    Write-Output "ERROR: AI_PROVIDER=gemini requires GEMINI_API_KEY."
    Write-Output "Options:"
    Write-Output "  1. Set GEMINI_API_KEY in $engineDir/.env"
    Write-Output "  2. Run: .\Run-AIEngine.ps1 -Provider gemini -GeminiApiKey 'AIza...'"
    Write-Output "  3. Set: `$env:GEMINI_API_KEY = 'AIza...'"
    Write-Output "  Get your key at: https://aistudio.google.com/app/apikey"
    Write-Output ""
    exit 1
  }
  $model = if ($env:GEMINI_MODEL) { $env:GEMINI_MODEL } else { "gemini-2.0-flash" }
  Write-Output "[config] Gemini model = $model"
}

# ----------------------------------------------------------------
# Override target URLs if provided
# ----------------------------------------------------------------
if (-not [string]::IsNullOrWhiteSpace($TargetBaseUrl)) {
  $env:TARGET_BASE_URL = $TargetBaseUrl
  Write-Output "[config] TARGET_BASE_URL = $TargetBaseUrl"
}
if (-not [string]::IsNullOrWhiteSpace($TargetBrowserUrl)) {
  $env:TARGET_BROWSER_URL = $TargetBrowserUrl
  Write-Output "[config] TARGET_BROWSER_URL = $TargetBrowserUrl"
}

# ----------------------------------------------------------------
# Auto-resolve localhost target when env still uses legacy :3000
# ----------------------------------------------------------------
$defaultLocalApiUrl = Get-DefaultLocalApiUrl -launchSettingsPath $launchSettingsFile
$legacyDefaultUrl = "http://localhost:3000"

if ([string]::IsNullOrWhiteSpace($env:TARGET_BASE_URL) -or $env:TARGET_BASE_URL -eq $legacyDefaultUrl) {
  $env:TARGET_BASE_URL = $defaultLocalApiUrl
  Write-Output "[config] TARGET_BASE_URL auto-resolved = $($env:TARGET_BASE_URL)"
}

if ([string]::IsNullOrWhiteSpace($env:TARGET_BROWSER_URL) -or $env:TARGET_BROWSER_URL -eq $legacyDefaultUrl) {
  $env:TARGET_BROWSER_URL = $env:TARGET_BASE_URL
  Write-Output "[config] TARGET_BROWSER_URL auto-resolved = $($env:TARGET_BROWSER_URL)"
}

$env:RUN_MODE = $Mode
Write-Output "[config] RUN_MODE = $Mode"

# ----------------------------------------------------------------
# Headed / SlowMo (browser visivel)
# ----------------------------------------------------------------
if ($Headed) {
  $env:HEADED     = "true"
  $env:SLOW_MO    = "$SlowMo"
  $env:STEP_DELAY = "$StepDelay"
  Write-Output "[config] HEADED = true (browser visivel)"
  Write-Output "[config] SLOW_MO    = ${SlowMo}ms por acao"
  Write-Output "[config] STEP_DELAY = ${StepDelay}ms apos cada passo"
}
else {
  $env:HEADED     = "false"
  $env:SLOW_MO    = "0"
  $env:STEP_DELAY = "0"
  Write-Output "[config] HEADED = false (modo headless)"
}

# ----------------------------------------------------------------
# Install Node dependencies
# ----------------------------------------------------------------
if (-not $SkipInstall) {
  Write-Output ""
  Write-Output "[install] Installing Node.js dependencies..."
  Push-Location $engineDir
  try {
    & npm install --prefer-offline --silent
    if ($LASTEXITCODE -ne 0) {
      Write-Output "[install] npm install failed — retrying with network..."
      & npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    Write-Output "[install] Dependencies ready."
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Output "[install] Skipping npm install (-SkipInstall)"
}

# ----------------------------------------------------------------
# Install Playwright browsers (Chromium only)
# ----------------------------------------------------------------
if (-not $SkipBrowserInstall -and ($Mode -eq "all" -or $Mode -eq "browser")) {
  Write-Output ""
  Write-Output "[install] Installing Playwright Chromium browser..."
  Push-Location $engineDir
  try {
    & npx playwright install chromium --with-deps 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Output "[install] Playwright browser install returned $LASTEXITCODE — continuing anyway"
    }
    else {
      Write-Output "[install] Chromium ready."
    }
  }
  finally {
    Pop-Location
  }
}

# ----------------------------------------------------------------
# Create reports directory
# ----------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

# ----------------------------------------------------------------
# Run the AI Engine
# ----------------------------------------------------------------
Write-Output ""
Write-Output "[run] Starting AI Engine (provider: $activeProvider | mode: $Mode)..."
Write-Output ""

$watch = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location $engineDir
try {
  & npx tsx src/index.ts "--mode=$Mode"
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}
$watch.Stop()

Write-Output ""
Write-Output "------------------------------------------------------------"
Write-Output "[run] AI Engine finished in $($watch.ElapsedMilliseconds)ms | exit code: $exitCode"

# ----------------------------------------------------------------
# Show report paths
# ----------------------------------------------------------------
$jsonReport = "$reportsDir/ai-final-report.json"
$htmlReport = "$reportsDir/ai-final-report.html"

if (Test-Path $jsonReport) {
  Write-Output "[report] JSON: $jsonReport"
}
if (Test-Path $htmlReport) {
  Write-Output "[report] HTML: $htmlReport"
  Write-Output "[report] Abrir: Start-Process '$htmlReport'"
}

Write-Output "============================================================"
Write-Output ""

exit $exitCode
