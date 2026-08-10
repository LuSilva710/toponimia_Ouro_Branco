param(
  [Parameter(Mandatory = $false)]
  [string]$Text = "",

  [Parameter(Mandatory = $false)]
  [string]$GeminiApiKey = "",

  [Parameter(Mandatory = $false)]
  [string]$OpenAIApiKey = "",

  # Mostra o browser visualmente durante os testes
  [Parameter(Mandatory = $false)]
  [switch]$Headed = $false,

  # Atraso entre cada acao do Playwright em ms
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

function Get-DefaultLocalApiUrl {
  param([string]$launchSettingsPath)

  $fallback = "http://localhost:3000"
  if (-not (Test-Path $launchSettingsPath)) { return $fallback }

  try {
    $launch = Get-Content $launchSettingsPath -Raw | ConvertFrom-Json
    $applicationUrl = $launch.iisSettings.iisExpress.applicationUrl
    if ([string]::IsNullOrWhiteSpace($applicationUrl)) { return $fallback }
    $firstUrl = ($applicationUrl -split ";")[0].Trim()
    if ([string]::IsNullOrWhiteSpace($firstUrl)) { return $fallback }
    return $firstUrl
  }
  catch {
    return $fallback
  }
}

$defaultLocalApiUrl = Get-DefaultLocalApiUrl -launchSettingsPath $launchSettingsFile

function Write-Header($t) {
  Write-Host ""; Write-Host ("=" * 60) -ForegroundColor Cyan
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host ("=" * 60) -ForegroundColor Cyan
}
function Write-Step($t)  { Write-Host ""; Write-Host "  >> $t" -ForegroundColor Yellow }
function Write-OK($t)    { Write-Host "  [OK] $t" -ForegroundColor Green }
function Write-Info($t)  { Write-Host "  [i]  $t" -ForegroundColor Gray }
function Write-Warn($t)  { Write-Host "  [!]  $t" -ForegroundColor DarkYellow }

# ================================================================
# Pedir texto se nao veio por parametro
# ================================================================

Write-Header "ROVIS AI Testing Engine — Quick Start"
Write-Host ""
Write-Host "  Digite uma descricao do que quer testar." -ForegroundColor White
Write-Host "  Exemplos:" -ForegroundColor Gray
Write-Host "    'teste minha api em $defaultLocalApiUrl'" -ForegroundColor DarkCyan
Write-Host "    'abre http://app.empresa.com faz login com user@test.com senha Test@123'" -ForegroundColor DarkCyan
Write-Host "    'valida os formularios do sistema em https://staging.empresa.com'" -ForegroundColor DarkCyan
Write-Host "    'testa a api e o browser em $defaultLocalApiUrl usuario admin senha 1234'" -ForegroundColor DarkCyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Text)) {
  Write-Host "  > " -ForegroundColor DarkCyan -NoNewline
  $Text = Read-Host
}

if ([string]::IsNullOrWhiteSpace($Text)) {
  Write-Host "  Nenhum texto informado. Usando defaults." -ForegroundColor DarkYellow
  $Text = "teste basico da api e formularios"
}

Write-Host ""
Write-Info "Texto recebido: $Text"

# ================================================================
# Resolver chave de API (do .env, parametro ou variavel de ambiente)
# ================================================================

$apiKey = ""
$provider = "codex"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^([^#=]+)=(.+)$") {
      $k = $Matches[1].Trim(); $v = $Matches[2].Trim().Trim('"').Trim("'")
      if ($v -notlike "your_*" -and -not [string]::IsNullOrWhiteSpace($v)) {
        [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
      }
    }
  }
}

if (-not [string]::IsNullOrWhiteSpace($GeminiApiKey))  { $env:GEMINI_API_KEY = $GeminiApiKey }
if (-not [string]::IsNullOrWhiteSpace($OpenAIApiKey))  { $env:OPENAI_API_KEY = $OpenAIApiKey }

# Detectar provider: codex > openai > gemini
$envProvider = $env:AI_PROVIDER
if (-not [string]::IsNullOrWhiteSpace($envProvider)) {
  $provider = $envProvider.ToLower()
} elseif (-not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
  $provider = "openai"
} elseif (-not [string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY)) {
  $provider = "gemini"
} else {
  $provider = "codex"
}

if ($provider -eq "codex") {
  # Codex CLI nao precisa de API key — verifica se o binario esta disponivel
  try {
    $null = Get-Command codex -ErrorAction Stop
    Write-Info "Provedor: Codex CLI"
  } catch {
    Write-Host ""
    Write-Host "  ERRO: AI_PROVIDER=codex mas o binario 'codex' nao foi encontrado no PATH." -ForegroundColor Red
    Write-Host "  Instale o Codex CLI ou troque para: AI_PROVIDER=gemini no .env" -ForegroundColor Yellow
    exit 1
  }
} elseif ($provider -eq "openai") {
  $apiKey = $env:OPENAI_API_KEY
  if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host ""
    Write-Host "  ERRO: AI_PROVIDER=openai mas OPENAI_API_KEY nao encontrada." -ForegroundColor Red
    Write-Host "  Defina OPENAI_API_KEY no .env ou passe -OpenAIApiKey 'sk-...'" -ForegroundColor Yellow
    exit 1
  }
  Write-Info "Provedor: OpenAI"
} elseif ($provider -eq "gemini") {
  $apiKey = $env:GEMINI_API_KEY
  if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host ""
    Write-Host "  ERRO: Nenhuma chave de API encontrada." -ForegroundColor Red
    Write-Host "  Rode primeiro: .\Setup-AIEngine.ps1" -ForegroundColor Yellow
    Write-Host "  Ou passe:      .\Run-Quick.ps1 -GeminiApiKey 'AIza...'" -ForegroundColor Yellow
    exit 1
  }
  Write-Info "Provedor: Google Gemini"
}
$env:AI_PROVIDER = $provider

# ================================================================
# Usar IA para extrair config do texto
# ================================================================

Write-Step "Analisando texto com IA..."

$parsePrompt = @"
Analise este texto de instrucao de teste e extraia as configuracoes.
Texto: "$Text"

Retorne APENAS um JSON valido com esta estrutura exata:
{
  "targetBaseUrl": "URL da API backend (ex: $defaultLocalApiUrl). Se nao mencionado, use $defaultLocalApiUrl",
  "targetBrowserUrl": "URL do frontend/browser. Se igual ao backend ou nao mencionado, use o mesmo valor de targetBaseUrl",
  "username": "email ou usuario de teste. Se nao mencionado, string vazia",
  "password": "senha de teste. Se nao mencionado, string vazia",
  "authUrl": "caminho da pagina de login (ex: /login). Se nao mencionado, use /login",
  "authEndpoint": "endpoint da API de login (ex: /api/auth/login). Se nao mencionado, use /api/auth/login",
  "mode": "all, api, browser ou generate. Inferir do contexto: se mencionar browser/interface/tela use browser, se mencionar api/endpoint use api, se mencionar campos/formularios use all. Padrao: all",
  "description": "resumo em 1 frase do que sera testado"
}
"@

function Invoke-GeminiParse($key, $prompt) {
  $body = @{
    contents = @(@{ parts = @(@{ text = $prompt }) })
    generationConfig = @{ temperature = 0.1; maxOutputTokens = 512 }
  } | ConvertTo-Json -Depth 10

  $model = if ($env:GEMINI_MODEL) { $env:GEMINI_MODEL } else { "gemini-2.0-flash" }
  $url = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$key"

  $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
  return $response.candidates[0].content.parts[0].text
}

function Invoke-OpenAIParse($key, $prompt) {
  $body = @{
    model = if ($env:OPENAI_MODEL) { $env:OPENAI_MODEL } else { "gpt-4o-mini" }
    temperature = 0.1
    response_format = @{ type = "json_object" }
    messages = @(
      @{ role = "system"; content = "Voce extrai configuracoes de testes de um texto. Retorne apenas JSON valido." }
      @{ role = "user"; content = $prompt }
    )
  } | ConvertTo-Json -Depth 10

  $headers = @{ "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }
  $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" -Method POST -Headers $headers -Body $body
  return $response.choices[0].message.content
}

function Invoke-CodexParse($prompt) {
  # Usa o Codex CLI para interpretar o texto
  $tmpFile = [System.IO.Path]::GetTempFileName() + ".txt"
  try {
    $codexArgs = @(
      "exec",
      "--skip-git-repo-check",
      "--color", "never",
      "-s", "read-only",
      "-m", $(if ($env:CODEX_MODEL) { $env:CODEX_MODEL } elseif ($env:OPENAI_MODEL) { $env:OPENAI_MODEL } else { "gpt-5.4-mini" }),
      "-o", $tmpFile,
      "-"
    )
    $prompt | & codex @codexArgs 2>$null
    if (Test-Path $tmpFile) {
      return Get-Content $tmpFile -Raw -Encoding utf8
    }
    return ""
  } finally {
    if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
  }
}

$parsed = $null
try {
  $rawJson = if ($provider -eq "codex") {
    Invoke-CodexParse ($parsePrompt + "`n`nReturn valid JSON only. No markdown, no commentary.")
  } elseif ($provider -eq "openai") {
    Invoke-OpenAIParse $apiKey $parsePrompt
  } else {
    Invoke-GeminiParse $apiKey $parsePrompt
  }

  # Limpar markdown se vier
  $cleanJson = $rawJson -replace "^```(?:json)?", "" -replace "```$", "" -replace "^\s+|\s+$", ""
  # Extrair JSON
  if ($cleanJson -match "(\{[\s\S]*\})") { $cleanJson = $Matches[1] }

  $parsed = $cleanJson | ConvertFrom-Json
  Write-OK "Texto interpretado: $($parsed.description)"
} catch {
  Write-Warn "Falha ao interpretar com IA — usando extrator basico"
  $parsed = $null
}

# ================================================================
# Fallback: extrator simples por regex
# ================================================================

if (-not $parsed) {
  $urlMatch  = [regex]::Match($Text, "https?://[^\s]+")
  $emailMatch = [regex]::Match($Text, "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
  # Senha: palavra apos "senha", "password", "pass", "pw"
  $passMatch = [regex]::Match($Text, "(?:senha|password|pass|pw)\s+(\S+)", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

  $parsed = [PSCustomObject]@{
    targetBaseUrl   = if ($urlMatch.Success)  { $urlMatch.Value }  else { $defaultLocalApiUrl }
    targetBrowserUrl = if ($urlMatch.Success)  { $urlMatch.Value }  else { $defaultLocalApiUrl }
    username        = if ($emailMatch.Success) { $emailMatch.Value } else { "" }
    password        = if ($passMatch.Success)  { $passMatch.Groups[1].Value } else { "" }
    authUrl         = "/login"
    authEndpoint    = "/api/auth/login"
    mode            = "all"
    description     = $Text
  }
}

# ================================================================
# Mostrar o que foi extraido e confirmar
# ================================================================

Write-Host ""
Write-Host ("─" * 60) -ForegroundColor DarkCyan
Write-Host "  Configuracao extraida:" -ForegroundColor White
Write-Host "    URL da API:     $($parsed.targetBaseUrl)" -ForegroundColor Cyan
Write-Host "    URL do browser: $($parsed.targetBrowserUrl)" -ForegroundColor Cyan
if ($parsed.username) {
  Write-Host "    Usuario:        $($parsed.username)" -ForegroundColor Cyan
  Write-Host "    Senha:          $("*" * [Math]::Min($parsed.password.Length, 8))" -ForegroundColor Cyan
  Write-Host "    Login URL:      $($parsed.authUrl)" -ForegroundColor Cyan
}
Write-Host "    Modo:           $($parsed.mode)" -ForegroundColor Cyan
Write-Host ("─" * 60) -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Confirmar e executar? [Enter = sim / N = cancelar]: " -ForegroundColor White -NoNewline
$confirm = Read-Host
if ($confirm.ToLower() -eq "n") { Write-Host "  Cancelado."; exit 0 }

# ================================================================
# Gravar / atualizar .env
# ================================================================

Write-Step "Atualizando .env..."

$envLines = @()
if (Test-Path $envFile) {
  $envLines = Get-Content $envFile
}

function Set-EnvValue($lines, $key, $value) {
  $found = $false
  $result = $lines | ForEach-Object {
    if ($_ -match "^$key=") { $found = $true; "$key=$value" }
    else { $_ }
  }
  if (-not $found) { $result += "$key=$value" }
  return $result
}

$envLines = Set-EnvValue $envLines "AI_PROVIDER" $provider
if ($provider -eq "openai" -and -not [string]::IsNullOrWhiteSpace($apiKey)) {
  $envLines = Set-EnvValue $envLines "OPENAI_API_KEY" $apiKey
} elseif ($provider -eq "gemini" -and -not [string]::IsNullOrWhiteSpace($apiKey)) {
  $envLines = Set-EnvValue $envLines "GEMINI_API_KEY" $apiKey
}
# codex nao precisa de API key no .env

$envLines = Set-EnvValue $envLines "TARGET_BASE_URL"    $parsed.targetBaseUrl
$envLines = Set-EnvValue $envLines "TARGET_BROWSER_URL" $parsed.targetBrowserUrl
$envLines = Set-EnvValue $envLines "RUN_MODE"           $parsed.mode

if ($parsed.username) {
  $envLines = Set-EnvValue $envLines "TEST_USERNAME"       $parsed.username
  $envLines = Set-EnvValue $envLines "TEST_PASSWORD"       $parsed.password
  $envLines = Set-EnvValue $envLines "TEST_AUTH_URL"       $parsed.authUrl
  $envLines = Set-EnvValue $envLines "TEST_AUTH_ENDPOINT"  $parsed.authEndpoint
}

New-Item -ItemType Directory -Force -Path $engineDir | Out-Null
$envLines | Set-Content -Path $envFile -Encoding utf8
Write-OK ".env atualizado"

# ================================================================
# Instalar dependencias (rapido se ja instalado)
# ================================================================

Write-Step "Verificando dependencias..."
Push-Location $engineDir
try {
  if (-not (Test-Path "node_modules")) {
    Write-Info "Instalando npm packages pela primeira vez..."
    & npm install --prefer-offline --silent
    if ($LASTEXITCODE -ne 0) { & npm install }
    Write-OK "npm packages instalados."
  } else {
    Write-Info "node_modules ja existe — pulando npm install."
  }

  $playwrightBin = "node_modules/.bin/playwright"
  $needsBrowser = ($parsed.mode -eq "all" -or $parsed.mode -eq "browser")
  if ($needsBrowser -and -not (Test-Path "$playwrightBin")) {
    Write-Info "Instalando Playwright Chromium..."
    & npx playwright install chromium --with-deps 2>&1 | Out-Null
    Write-OK "Chromium instalado."
  }
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

# ================================================================
# EXECUTAR
# ================================================================

Write-Header "Executando testes..."
Write-Host ""

$env:TARGET_BASE_URL    = $parsed.targetBaseUrl
$env:TARGET_BROWSER_URL = $parsed.targetBrowserUrl
$env:RUN_MODE           = $parsed.mode
$env:AI_PROVIDER        = $provider
if ($parsed.username) {
  $env:TEST_USERNAME = $parsed.username
  $env:TEST_PASSWORD = $parsed.password
}

if ($Headed) {
  $env:HEADED     = "true"
  $env:SLOW_MO    = "$SlowMo"
  $env:STEP_DELAY = "$StepDelay"
  Write-Info "Modo visual: browser sera exibido"
  Write-Info "  SlowMo:    ${SlowMo}ms por acao"
  Write-Info "  StepDelay: ${StepDelay}ms apos cada passo"
} else {
  $env:HEADED     = "false"
  $env:SLOW_MO    = "0"
  $env:STEP_DELAY = "0"
}

$watch = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location $engineDir
try {
  & npx tsx src/index.ts "--mode=$($parsed.mode)"
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
$watch.Stop()

# ================================================================
# RESULTADO
# ================================================================

Write-Host ""
Write-Header "Resultado"

$htmlReport = "$reportsDir/ai-final-report.html"
$jsonReport = "$reportsDir/ai-final-report.json"

if (Test-Path $jsonReport) {
  $report    = Get-Content $jsonReport -Raw -Encoding utf8 | ConvertFrom-Json
  $score     = $report.qualityScore.total
  $band      = $report.qualityScore.band.ToUpper()
  $passed    = $report.summary.passed
  $failed    = $report.summary.failed
  $total     = $report.summary.totalCases
  $dur       = [math]::Round($watch.ElapsedMilliseconds / 1000, 1)
  $scoreColor = if ($score -ge 85) {"Green"} elseif ($score -ge 70) {"Cyan"} elseif ($score -ge 50) {"Yellow"} else {"Red"}

  Write-Host ""
  Write-Host "  Quality Score: " -NoNewline -ForegroundColor White
  Write-Host "$score/100 [$band]" -ForegroundColor $scoreColor
  Write-Host "  Passed:  $passed / $total" -ForegroundColor Green
  if ($failed -gt 0) { Write-Host "  Failed:  $failed" -ForegroundColor Red }
  Write-Host "  Duracao: ${dur}s" -ForegroundColor Gray

  if ($report.aiInsights) {
    Write-Host ""
    Write-Host "  AI:" -ForegroundColor Yellow
    $report.aiInsights | Select-Object -First 2 | ForEach-Object {
      Write-Host "    - $_" -ForegroundColor Gray
    }
  }

  if (Test-Path $htmlReport) {
    Write-Host ""
    Write-Host "  Relatorio: $htmlReport" -ForegroundColor Cyan
    Write-Host "  Abrir agora? [Enter = sim / N = nao]: " -ForegroundColor White -NoNewline
    $open = Read-Host
    if ($open.ToLower() -ne "n") { Start-Process $htmlReport }
  }
} else {
  Write-Warn "Relatorio nao gerado — veja os logs acima."
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
exit $exitCode
