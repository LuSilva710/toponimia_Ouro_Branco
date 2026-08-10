param(
    [Parameter(Mandatory = $true)]
    [string]$Text,

    [string]$Root = ".cursor"
)

$ErrorActionPreference = "Stop"

function Test-ContainsAny {
    param(
        [string]$InputText,
        [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($InputText -like "*$pattern*") {
            return $true
        }
    }

    return $false
}

function Get-MatchCount {
    param(
        [string]$InputText,
        [string[]]$Patterns
    )

    $count = 0
    foreach ($pattern in $Patterns) {
        if ($InputText -like "*$pattern*") { $count++ }
    }
    return $count
}

# 1. CARREGAR MANIFESTO

$manifestPath = Join-Path $Root "governance/mode-manifest.json"
if (-not (Test-Path $manifestPath)) {
    throw "Mode manifest not found: $manifestPath"
}

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$normalizedText = $Text.Trim()
$lowerText      = $normalizedText.ToLowerInvariant()

# 2. RESOLVER MODO

$mode = $manifest.defaultMode
foreach ($entry in $manifest.modes) {
    foreach ($command in $entry.activationCommands) {
        if ($lowerText -eq $command.ToLowerInvariant()) {
            $mode = $entry.id
            break
        }
    }
}

# 3. CARREGAR CONTEXTO DO WORKSET (O5)

$worksetPath = Join-Path $Root "memory/12-active-workset.md"
$inheritedContext = $null
$inheritedDomain  = $null

if (Test-Path $worksetPath) {
    $worksetContent = Get-Content $worksetPath -Raw -Encoding UTF8
    if ($worksetContent -match "Objetivo atual:\s*\r?\n-\s*(.+)") {
        $inheritedContext = $matches[1].Trim()
    }

    if ($worksetContent -match "(?i)backend|api|controller|service") {
        $inheritedDomain = "backend"
    } elseif ($worksetContent -match "(?i)frontend|component|tela|ui|css|tsx") {
        $inheritedDomain = "frontend"
    }
}

# 4. INTENT DE TESTE

$testKeywords = @(
    "testa", "testar", "teste", "rodar teste", "rodar testes",
    "roda o engine", "executa os testes", "validar", "valida",
    "verificar", "verifica"
)

$testingRequested = Test-ContainsAny -InputText $lowerText -Patterns $testKeywords
$qaOnly           = $mode -eq "QA_ONLY" -or $testingRequested

# 5. CLASSIFICACAO DE INTAKE

$fullKeywords = @(
    "codigo", "contrato", "qa", "endpoint", "api", "implement", "refactor",
    "governanca", "automacao", "script", "backend", "frontend",
    "criar", "adicionar", "remover", "alterar", "corrigir", "refatorar",
    "atualizar", "instalar"
)

$lightKeywords = @(
    "analise", "planejamento", "esclare", "duvida", "como", "por que",
    "pode", "qual", "explica", "diagnost", "entender"
)

$spikeKeywords = @(
    "explora", "ideia", "brainstorm", "considera", "que tal",
    "hipotese", "estuda"
)

$fullHits  = Get-MatchCount $lowerText $fullKeywords
$lightHits = Get-MatchCount $lowerText $lightKeywords
$spikeHits = Get-MatchCount $lowerText $spikeKeywords

# 6. INTAKE DECISION

$intake = if ($qaOnly) {
    "PM-FULL"
}
elseif ($spikeHits -ge 1 -and $fullHits -eq 0) {
    "PM-SPIKE"
}
elseif ($fullHits -ge 1) {
    "PM-FULL"
}
elseif ($lightHits -ge 1) {
    "PM-LIGHT"
}
else {
    "PM-LIGHT"
}

# 7. TIER DE CONFIANCA (O7)

$totalHits = $fullHits + $lightHits + $spikeHits
$confidence = if ($totalHits -ge 2) {
    "high"
}
elseif ($totalHits -eq 1) {
    "medium"
}
else {
    "low"
}

# Heuristica: confianca baixa em PM-FULL vira PM-LIGHT por seguranca
$rationale = @()
if ($confidence -eq "low" -and $intake -eq "PM-FULL") {
    $rationale += "Confianca baixa em PM-FULL: rebaixado para PM-LIGHT para evitar gate desnecessario"
    $intake = "PM-LIGHT"
}

if ($inheritedDomain) {
    $rationale += "Dominio herdado do workset: $inheritedDomain"
}

# 8. ESTADO E APROVACAO

$requiresApproval = ($intake -eq "PM-FULL")
$state = if ($qaOnly) {
    "QA_ONLY"
}
elseif ($intake -eq "PM-FULL") {
    "AWAITING_APPROVAL"
}
elseif ($intake -eq "PM-SPIKE") {
    "INTAKE"
}
else {
    "PLANNING"
}

# 9. SOURCE OF TRUTH

$modeEntry = $manifest.modes | Where-Object { $_.id -eq $mode } | Select-Object -First 1
$sourceOfTruth = @(
    ".cursor/bootstrap.md",
    ".cursor/governance/state-machine.md",
    ".cursor/governance/memory-contract.md",
    ".cursor/governance/mode-manifest.json",
    ".cursor/governance/intent-router.md",
    ".cursor/governance/orchestrator-preflight.json"
)

if ($modeEntry -and $modeEntry.agentFile) {
    $sourceOfTruth += $modeEntry.agentFile
}

# 10. OUTPUT

[pscustomobject]@{
    mode              = $mode
    intake            = $intake
    state             = $state
    requiresApproval  = $requiresApproval
    activateTesting   = $qaOnly
    confidence        = $confidence
    keywordHits       = @{
        full  = $fullHits
        light = $lightHits
        spike = $spikeHits
    }
    inheritedContext  = $inheritedContext
    inheritedDomain   = $inheritedDomain
    rationale         = $rationale
    sourceOfTruth     = $sourceOfTruth
} | ConvertTo-Json -Depth 5
