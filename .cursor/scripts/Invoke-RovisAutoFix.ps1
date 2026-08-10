# Invoke-RovisAutoFix.ps1 (v2)
# Loop QA-fail -> diagnose via codex MCP -> patch -> re-test.
# Este script NAO chama MCP diretamente. Ele:
#   1) Le o report QA failed
#   2) Consulta Get-RovisFixSuggestion para padroes ja aprendidos
#   3) Gera next-prompt.json com o prompt pronto para ROVIS chamar codex MCP via tool
#   4) Apos ROVIS preencher resposta, agentes de dominio aplicam patch (com aprovado)

[CmdletBinding()]
param(
    [string]$PolicyPath    = ".cursor/governance/auto-fix-loop.json",
    [string]$ProtocolsPath = ".cursor/governance/mcp-protocols.json",
    [string]$ReportPath    = ".cursor/testing-module/reports/ai-final-report.json",
    [string]$OutputPath    = ".cursor/testing-module/reports/auto-fix-report.json",
    [string]$NextPromptPath = ".cursor/testing-module/reports/auto-fix-next-prompt.json",
    [int]$MaxAttempts      = 0,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

foreach ($p in @($OutputPath, $NextPromptPath)) {
    $d = Split-Path $p -Parent
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

if (-not (Test-Path $PolicyPath))    { Write-Host "[AUTO-FIX] Politica ausente"; exit 1 }
if (-not (Test-Path $ProtocolsPath)) { Write-Host "[AUTO-FIX] Protocolos ausentes"; exit 1 }

$policy    = Get-Content $PolicyPath    -Raw | ConvertFrom-Json
$protocols = Get-Content $ProtocolsPath -Raw | ConvertFrom-Json

if (-not $policy.enabled) { Write-Host "[AUTO-FIX] Desabilitado"; exit 0 }
if ($MaxAttempts -le 0) { $MaxAttempts = $policy.maxAttempts }

if (-not (Test-Path $ReportPath)) {
    Write-Host "[AUTO-FIX] Sem report QA"
    exit 0
}

$report = Get-Content $ReportPath -Raw | ConvertFrom-Json
$failed = @($report.cases | Where-Object { $_.status -eq "failed" })

if ($failed.Count -eq 0) {
    Write-Host "[AUTO-FIX] Nenhum caso failed"
    @{ generatedAt=(Get-Date).ToString("o"); failedCount=0; nothingToDo=$true } |
        ConvertTo-Json | Set-Content -Path $OutputPath -Encoding UTF8
    exit 0
}

Write-Host "[AUTO-FIX] $($failed.Count) caso(s) failed | maxAttempts=$MaxAttempts"

$suggestions = @()
$suggestPath = ".cursor/scripts/Get-RovisFixSuggestion.ps1"
if (Test-Path $suggestPath) {
    foreach ($c in $failed) {
        $symptom = if ($c.errorMessage) { $c.errorMessage } else { $c.id }
        try {
            $sugRaw = & powershell -ExecutionPolicy Bypass -File $suggestPath -Symptom $symptom 2>$null
            $jsonPart = ($sugRaw -join "`n") -replace "(?s)^.*?(\{.*\}).*$", '$1'
            $sug = $jsonPart | ConvertFrom-Json -ErrorAction Stop
            $suggestions += @{ caseId = $c.id; suggestion = $sug.suggestion; bestScore = $sug.bestScore }
        } catch {
            $suggestions += @{ caseId = $c.id; suggestion = "CREATE_NEW"; bestScore = 0 }
        }
    }
}

$changedFiles = @()
try {
    $diff = git diff --name-only HEAD~1 2>$null
    if ($diff) { $changedFiles = @($diff) }
} catch {}

$promptDef = $protocols.prompts.autoFixDiagnose
$prompt = $promptDef.template `
    -replace "\{failedCases\}",  (($failed | ForEach-Object { $_.id }) -join ", ") `
    -replace "\{changedFiles\}", ($changedFiles -join ", ")

$nextPrompt = [ordered]@{
    generatedAt    = (Get-Date).ToString("o")
    provider       = $promptDef.provider
    mcpServer      = $protocols.providers.($promptDef.provider).mcpServer
    title          = $promptDef.title
    prompt         = $prompt
    expectedSchema = $promptDef.schema
    failedCount    = $failed.Count
    failedIds      = @($failed | ForEach-Object { $_.id })
    suggestions    = $suggestions
    instructions   = "ROVIS deve chamar o MCP {mcpServer} com o campo 'prompt' e salvar a resposta no campo 'mcpResponse' deste arquivo. Depois, agente de dominio aplica patch com aprovado humano."
    mcpResponse    = $null
}
$nextPrompt | ConvertTo-Json -Depth 8 | Set-Content -Path $NextPromptPath -Encoding UTF8

$summary = [ordered]@{
    generatedAt   = (Get-Date).ToString("o")
    policy        = $policy.version
    failedCount   = $failed.Count
    suggestions   = $suggestions
    nextPromptFile = $NextPromptPath
    status         = "awaiting-mcp-call"
    requireApprovalForApply = $policy.rules.requireApprovalForApply
    dryRun         = [bool]$DryRun
}
$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputPath -Encoding UTF8

$reuseCount = ($suggestions | Where-Object { $_.suggestion -eq "REUSE" }).Count
Write-Host "[AUTO-FIX] suggestions: REUSE=$reuseCount CREATE_NEW=$($suggestions.Count - $reuseCount)"
Write-Host "[AUTO-FIX] next-prompt: $NextPromptPath"
Write-Host "[AUTO-FIX] summary: $OutputPath"
Write-Host "[AUTO-FIX] proxima acao: ROVIS chama MCP $($protocols.providers.($promptDef.provider).mcpServer) com o prompt e preenche mcpResponse no next-prompt.json"
