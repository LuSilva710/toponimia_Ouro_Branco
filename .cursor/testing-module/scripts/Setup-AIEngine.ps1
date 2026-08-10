param(
  [switch]$Reset = $false,
  [switch]$SkipRun = $false
)

$ErrorActionPreference = "Stop"
$engineDir = ".cursor/testing-module/ai-engine"
$envFile = "$engineDir/.env"
$reportsDir = ".cursor/testing-module/reports"

# ================================================================
# Helpers
# ================================================================

function Write-Header($text) {
  Write-Host ""
  Write-Host ("=" * 60) -ForegroundColor Cyan
  Write-Host "  $text" -ForegroundColor Cyan
  Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Step($text) {
  Write-Host ""
  Write-Host "  >> $text" -ForegroundColor Yellow
}

function Write-OK($text) {
  Write-Host "  [OK] $text" -ForegroundColor Green
}

function Write-Info($text) {
  Write-Host "  [i]  $text" -ForegroundColor Gray
}

function Write-Warn($text) {
  Write-Host "  [!]  $text" -ForegroundColor DarkYellow
}

function Ask($question, $default = "", $secret = $false) {
  $hint = if ($default) { " [Enter = $default]" } else { "" }
  Write-Host ""
  Write-Host "  ? $question$hint" -ForegroundColor White -NoNewline
  Write-Host ""
  Write-Host "    > " -ForegroundColor DarkCyan -NoNewline
  if ($secret) {
    $secure = Read-Host -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $value = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } else {
    $value = Read-Host
  }
  if ([string]::IsNullOrWhiteSpace($value)) { return $default }
  return $value.Trim()
}

function AskChoice($question, $options, $default = "1") {
  Write-Host ""
  Write-Host "  ? $question" -ForegroundColor White
  for ($i = 0; $i -lt $options.Count; $i++) {
    Write-Host "    $($i+1)) $($options[$i])" -ForegroundColor DarkCyan
  }
  Write-Host ""
  Write-Host "    Escolha [1-$($options.Count), Enter = $default]: " -ForegroundColor White -NoNewline
  $choice = Read-Host
  if ([string]::IsNullOrWhiteSpace($choice)) { $choice = $default }
  $idx = [int]$choice - 1
  if ($idx -lt 0 -or $idx -ge $options.Count) { return $options[[int]$default - 1] }
  return $options[$idx]
}

function AskYesNo($question, $default = "s") {
  Write-Host ""
  Write-Host "  ? $question [s/n, Enter = $default]: " -ForegroundColor White -NoNewline
  $r = Read-Host
  if ([string]::IsNullOrWhiteSpace($r)) { $r = $default }
  return $r.ToLower() -eq "s" -or $r.ToLower() -eq "y"
}

# ================================================================
# Check if .env already exists and ask about reset
# ================================================================

Write-Header "ROVIS AI Testing Engine — Setup Interativo"
Write-Host ""
Write-Host "  Vou configurar tudo automaticamente para voce." -ForegroundColor White
Write-Host "  Responda as perguntas abaixo (Enter para usar o padrao)." -ForegroundColor Gray

if ((Test-Path $envFile) -and -not $Reset) {
  Write-Host ""
  Write-Host "  [!] Ja existe um .env configurado." -ForegroundColor DarkYellow
  $reconfig = AskYesNo "Reconfigurar tudo do zero?" "n"
  if (-not $reconfig) {
    Write-Step "Pulando configuracao, usando .env existente"
    Write-Info "Para reconfigurar: .\Setup-AIEngine.ps1 -Reset"
    # Jump directly to install + run
    goto_install = $true
  }
}

$config = @{}

if (-not $goto_install) {
  # ================================================================
  # 1. AI PROVIDER
  # ================================================================

  Write-Header "1/5 — Provedor de IA"
  Write-Info "O engine usa IA para gerar cenarios de teste e analisar falhas."

  $providerChoice = AskChoice "Qual provedor de IA voce quer usar?" @(
    "Google Gemini  (gratis, recomendado — aistudio.google.com)"
    "OpenAI / Codex (pago — platform.openai.com)"
  ) "1"

  if ($providerChoice -like "*Gemini*") {
    $config["AI_PROVIDER"] = "gemini"
    Write-Info "Chave Gemini: https://aistudio.google.com/app/apikey"
    $config["GEMINI_API_KEY"] = Ask "Cole sua GEMINI_API_KEY" "" $true
    $modelChoice = AskChoice "Qual modelo Gemini?" @(
      "gemini-2.0-flash  (rapido, recomendado)"
      "gemini-1.5-pro    (mais poderoso)"
      "gemini-1.5-flash  (ultra rapido)"
    ) "1"
    $config["GEMINI_MODEL"] = switch -Wildcard ($modelChoice) {
      "*2.0-flash*" { "gemini-2.0-flash" }
      "*1.5-pro*"   { "gemini-1.5-pro" }
      "*1.5-flash*" { "gemini-1.5-flash" }
      default       { "gemini-2.0-flash" }
    }
  } else {
    $config["AI_PROVIDER"] = "openai"
    Write-Info "Chave OpenAI: https://platform.openai.com/api-keys"
    $config["OPENAI_API_KEY"] = Ask "Cole sua OPENAI_API_KEY" "" $true
    $modelChoice = AskChoice "Qual modelo OpenAI?" @(
      "gpt-4o-mini  (barato e rapido, recomendado)"
      "gpt-4o      (melhor qualidade)"
      "o1-mini     (raciocinio)"
    ) "1"
    $config["OPENAI_MODEL"] = switch -Wildcard ($modelChoice) {
      "*mini*"  { "gpt-4o-mini" }
      "*4o*"    { "gpt-4o" }
      "*o1*"    { "o1-mini" }
      default   { "gpt-4o-mini" }
    }
  }

  # ================================================================
  # 2. TARGETS (URLs)
  # ================================================================

  Write-Header "2/5 — URLs do Sistema"
  Write-Info "Informe as URLs do sistema que sera testado."
  Write-Info "(Se ainda nao estiver rodando, use http://localhost:3000 como padrao)"

  $config["TARGET_BASE_URL"] = Ask "URL da API / backend" "http://localhost:3000"

  $sameFrontend = AskYesNo "O frontend usa a mesma URL da API?" "s"
  if ($sameFrontend) {
    $config["TARGET_BROWSER_URL"] = $config["TARGET_BASE_URL"]
    Write-Info "Browser URL = $($config["TARGET_BASE_URL"])"
  } else {
    $config["TARGET_BROWSER_URL"] = Ask "URL do frontend (browser/Playwright)" "http://localhost:4200"
  }

  # ================================================================
  # 3. AUTENTICACAO
  # ================================================================

  Write-Header "3/5 — Autenticacao"
  Write-Info "Se configurar login, o engine faz login real e testa como usuario autenticado."

  $hasAuth = AskYesNo "Quer configurar login automatico? (usuario + senha de teste)" "s"

  if ($hasAuth) {
    Write-Warn "Use credenciais de teste/staging — NUNCA as de producao!"
    $config["TEST_USERNAME"] = Ask "E-mail ou usuario de teste" "testuser@staging.com"
    $config["TEST_PASSWORD"] = Ask "Senha do usuario de teste" "" $true
    $config["TEST_AUTH_URL"]  = Ask "URL de login no browser (pagina de login)" "/login"
    $config["TEST_AUTH_ENDPOINT"] = Ask "Endpoint da API de login (POST)" "/api/auth/login"

    $hasCustomSelectors = AskYesNo "Os seletores de login sao personalizados? (nao = deixa o engine descobrir)" "n"
    if ($hasCustomSelectors) {
      $config["TEST_USERNAME_SELECTOR"] = Ask "Seletor do campo de usuario" "input[name=email]"
      $config["TEST_PASSWORD_SELECTOR"] = Ask "Seletor do campo de senha" "input[type=password]"
      $config["TEST_SUBMIT_SELECTOR"]   = Ask "Seletor do botao de submit" "button[type=submit]"
      $config["TEST_AUTH_INDICATOR"]    = Ask "Seletor que indica usuario logado" ".user-menu,.avatar,[data-user]"
    }
  } else {
    Write-Info "Sem auth — testes rodaram sem login (endpoints publicos e validacoes de campos)."
  }

  # ================================================================
  # 4. MODO DE EXECUCAO
  # ================================================================

  Write-Header "4/5 — Modo de Execucao"

  $modeChoice = AskChoice "Como voce quer rodar os testes?" @(
    "all       — tudo: API + browser + campos + mascaras (recomendado)"
    "api       — apenas testes de API/HTTP"
    "browser   — apenas testes no browser (Playwright)"
    "generate  — apenas gerar os casos, sem executar"
  ) "1"

  $config["RUN_MODE"] = switch -Wildcard ($modeChoice) {
    "*api*"      { "api" }
    "*browser*"  { "browser" }
    "*generate*" { "generate" }
    default      { "all" }
  }

  $config["MAX_CASES_PER_CONTRACT"] = Ask "Maximo de casos por contrato" "20"

  # ================================================================
  # 5. CONTRATOS
  # ================================================================

  Write-Header "5/5 — Contratos"
  $config["CONTRACTS_PATH"] = Ask "Caminho dos contratos (relativo ao repo)" ".cursor/contracts"
  $config["AI_REPORT_PATH"] = ".cursor/testing-module/reports/ai-final-report.json"
  $config["AI_HTML_REPORT_PATH"] = ".cursor/testing-module/reports/ai-final-report.html"

  # ================================================================
  # Gravar .env
  # ================================================================

  Write-Step "Gravando .env..."

  $lines = @()
  $lines += "# Gerado automaticamente por Setup-AIEngine.ps1 — $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  $lines += ""
  $lines += "# === AI PROVIDER ==="
  $lines += "AI_PROVIDER=$($config["AI_PROVIDER"])"
  $lines += ""
  $lines += "# === GEMINI ==="
  $lines += "GEMINI_API_KEY=$($config["GEMINI_API_KEY"] ?? "")"
  $lines += "GEMINI_MODEL=$($config["GEMINI_MODEL"] ?? "gemini-2.0-flash")"
  $lines += ""
  $lines += "# === OPENAI / CODEX ==="
  $lines += "OPENAI_API_KEY=$($config["OPENAI_API_KEY"] ?? "")"
  $lines += "OPENAI_MODEL=$($config["OPENAI_MODEL"] ?? "gpt-4o-mini")"
  $lines += ""
  $lines += "# === TARGETS ==="
  $lines += "TARGET_BASE_URL=$($config["TARGET_BASE_URL"])"
  $lines += "TARGET_BROWSER_URL=$($config["TARGET_BROWSER_URL"])"
  $lines += ""
  $lines += "# === AUTH ==="
  $lines += "TEST_USERNAME=$($config["TEST_USERNAME"] ?? "")"
  $lines += "TEST_PASSWORD=$($config["TEST_PASSWORD"] ?? "")"
  $lines += "TEST_AUTH_URL=$($config["TEST_AUTH_URL"] ?? "/login")"
  $lines += "TEST_AUTH_ENDPOINT=$($config["TEST_AUTH_ENDPOINT"] ?? "/api/auth/login")"
  if ($config["TEST_USERNAME_SELECTOR"]) {
    $lines += "TEST_USERNAME_SELECTOR=$($config["TEST_USERNAME_SELECTOR"])"
    $lines += "TEST_PASSWORD_SELECTOR=$($config["TEST_PASSWORD_SELECTOR"])"
    $lines += "TEST_SUBMIT_SELECTOR=$($config["TEST_SUBMIT_SELECTOR"])"
    $lines += "TEST_AUTH_INDICATOR=$($config["TEST_AUTH_INDICATOR"])"
  }
  $lines += ""
  $lines += "# === ENGINE ==="
  $lines += "RUN_MODE=$($config["RUN_MODE"])"
  $lines += "MAX_CASES_PER_CONTRACT=$($config["MAX_CASES_PER_CONTRACT"])"
  $lines += "CONTRACTS_PATH=$($config["CONTRACTS_PATH"])"
  $lines += "AI_REPORT_PATH=$($config["AI_REPORT_PATH"])"
  $lines += "AI_HTML_REPORT_PATH=$($config["AI_HTML_REPORT_PATH"])"

  New-Item -ItemType Directory -Force -Path $engineDir | Out-Null
  $lines | Set-Content -Path $envFile -Encoding utf8
  Write-OK ".env criado em: $envFile"
}

# ================================================================
# INSTALL — npm + Playwright
# ================================================================

Write-Header "Instalando dependencias..."

Write-Step "npm install..."
Push-Location $engineDir
try {
  & npm install --prefer-offline 2>&1 | Where-Object { $_ -match "added|warn|error" } | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "npm install falhou offline, tentando com rede..."
    & npm install 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }
  }
  Write-OK "Dependencias Node.js instaladas."
} finally {
  Pop-Location
}

# Read mode from env if already existed
$runMode = $config["RUN_MODE"]
if ([string]::IsNullOrWhiteSpace($runMode) -and (Test-Path $envFile)) {
  $envContent = Get-Content $envFile
  $modeMatch = $envContent | Where-Object { $_ -match "^RUN_MODE=" }
  if ($modeMatch) { $runMode = ($modeMatch -split "=", 2)[1].Trim() }
}
if ([string]::IsNullOrWhiteSpace($runMode)) { $runMode = "all" }

if ($runMode -eq "all" -or $runMode -eq "browser") {
  Write-Step "Instalando Playwright (Chromium)..."
  Push-Location $engineDir
  try {
    & npx playwright install chromium --with-deps 2>&1 | ForEach-Object {
      if ($_ -match "chromium|installing|downloaded|done" -or $_ -match "error") {
        Write-Host "    $_" -ForegroundColor Gray
      }
    }
    Write-OK "Playwright Chromium instalado."
  } catch {
    Write-Warn "Playwright install retornou erro — continuando. ($($_.Exception.Message))"
  } finally {
    Pop-Location
  }
}

New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

# ================================================================
# EXECUTAR
# ================================================================

if ($SkipRun) {
  Write-Header "Setup concluido!"
  Write-OK "Para rodar o engine:"
  Write-Host ""
  Write-Host "    powershell -ExecutionPolicy Bypass -File .cursor/testing-module/scripts/Run-AIEngine.ps1" -ForegroundColor Cyan
  Write-Host ""
  exit 0
}

Write-Header "Tudo pronto! Iniciando engine..."
Write-Host ""
Write-Host "  O engine vai:" -ForegroundColor White
Write-Host "    1. Ler os contratos em .cursor/contracts/" -ForegroundColor Gray
Write-Host "    2. Usar IA para gerar cenarios de teste" -ForegroundColor Gray
Write-Host "    3. Abrir o browser e fazer login (se configurado)" -ForegroundColor Gray
Write-Host "    4. Executar todos os testes" -ForegroundColor Gray
Write-Host "    5. Analisar falhas com IA e dar score de qualidade" -ForegroundColor Gray
Write-Host "    6. Gerar relatorio HTML" -ForegroundColor Gray
Write-Host ""

$watch = [System.Diagnostics.Stopwatch]::StartNew()

Push-Location $engineDir
try {
  & npx tsx src/index.ts "--mode=$runMode"
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

$watch.Stop()

Write-Host ""
Write-Header "Resultado"

$jsonReport = "$reportsDir/ai-final-report.json"
$htmlReport = "$reportsDir/ai-final-report.html"

if (Test-Path $jsonReport) {
  $report = Get-Content $jsonReport -Raw -Encoding utf8 | ConvertFrom-Json
  $score   = $report.qualityScore.total
  $band    = $report.qualityScore.band.ToUpper()
  $passed  = $report.summary.passed
  $failed  = $report.summary.failed
  $total   = $report.summary.totalCases
  $dur     = [math]::Round($watch.ElapsedMilliseconds / 1000, 1)

  $scoreColor = if ($score -ge 85) { "Green" } elseif ($score -ge 70) { "Cyan" } elseif ($score -ge 50) { "Yellow" } else { "Red" }

  Write-Host ""
  Write-Host "  Quality Score: " -NoNewline -ForegroundColor White
  Write-Host "$score/100 [$band]" -ForegroundColor $scoreColor
  Write-Host "  Passed:  $passed / $total" -ForegroundColor Green
  if ($failed -gt 0) {
    Write-Host "  Failed:  $failed" -ForegroundColor Red
  }
  Write-Host "  Duracao: ${dur}s" -ForegroundColor Gray
  Write-Host ""

  if (Test-Path $htmlReport) {
    Write-Host "  Relatorio HTML: $htmlReport" -ForegroundColor Cyan
    $openReport = AskYesNo "Abrir relatorio HTML agora?" "s"
    if ($openReport) {
      Start-Process $htmlReport
    }
  }

  if ($failed -gt 0 -and $report.aiInsights) {
    Write-Host ""
    Write-Host "  AI Insights:" -ForegroundColor Yellow
    $report.aiInsights | Select-Object -First 3 | ForEach-Object {
      Write-Host "    - $_" -ForegroundColor Gray
    }
  }
} else {
  Write-Warn "Relatorio nao gerado. Verifique os logs acima."
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  Para rodar novamente:" -ForegroundColor White
Write-Host "    powershell -ExecutionPolicy Bypass -File .cursor/testing-module/scripts/Run-AIEngine.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para reconfigurar:" -ForegroundColor White
Write-Host "    powershell -ExecutionPolicy Bypass -File .cursor/testing-module/scripts/Setup-AIEngine.ps1 -Reset" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""

exit $exitCode
