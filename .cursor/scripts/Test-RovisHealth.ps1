param(
    [string]$Root = ".",
    [int]$ColdLineThreshold = 3000
)

$ErrorActionPreference = "Stop"

$results     = [System.Collections.Generic.List[hashtable]]::new()
$hasCritical = $false

function Add-Check {
    param([string]$Cat, [string]$Item, [string]$Level, [string]$Detail)
    $results.Add(@{ Cat = $Cat; Item = $Item; Level = $Level; Detail = $Detail })
    if ($Level -eq "CRITICO") { $script:hasCritical = $true }
}

function Get-FileLineCount {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    return (Get-Content $Path -Encoding UTF8).Count
}

function Test-FileRecent {
    param([string]$Path, [int]$MaxDays = 60)
    if (-not (Test-Path $Path)) { return $false }
    $age = (Get-Date) - (Get-Item $Path).LastWriteTime
    return ($age.TotalDays -le $MaxDays)
}

# 1. MEMORIA QUENTE

$hotFiles = @("index.md", "11-session-summary.md", "12-active-workset.md", "00-context.md")

foreach ($f in $hotFiles) {
    $p = Join-Path $Root ".cursor/memory/$f"
    if (-not (Test-Path $p)) {
        Add-Check "Memoria Quente" $f "CRITICO" "Arquivo ausente"
    } elseif (-not (Test-FileRecent $p)) {
        Add-Check "Memoria Quente" $f "AVISO" "Existe mas pode estar desatualizado (>60 dias)"
    } else {
        Add-Check "Memoria Quente" $f "OK" "Existe e recente"
    }
}

$cp = Join-Path $Root ".cursor/memory/10-checkpoint.md"
if (Test-Path $cp) {
    Add-Check "Memoria Quente" "10-checkpoint.md" "OK" "Existe"
} else {
    Add-Check "Memoria Quente" "10-checkpoint.md" "AVISO" "Nenhum checkpoint registrado"
}

# 2. MEMORIA FRIA

$coldFiles = @("03-backlog.md", "04-planning-log.md", "06-implementation-log.md", "07-testing-log.md", "09-done.md")

foreach ($f in $coldFiles) {
    $p     = Join-Path $Root ".cursor/memory/$f"
    $lines = Get-FileLineCount $p
    if ($lines -ge $ColdLineThreshold) {
        Add-Check "Memoria Fria" $f "AVISO" "$lines linhas - executar Compress-RovisMemory.ps1"
    } else {
        Add-Check "Memoria Fria" $f "OK" "$lines linhas"
    }
}

# 3. GOVERNANCE

$govFiles = @(
    ".cursor/bootstrap.md",
    ".cursor/governance/state-machine.md",
    ".cursor/governance/memory-contract.md",
    ".cursor/governance/mode-manifest.json",
    ".cursor/governance/intent-router.md",
    ".cursor/governance/agent-capabilities.json",
    ".cursor/governance/handoff-contract.json",
    ".cursor/governance/stage-score-rules.json",
    ".cursor/governance/closeout-contract.json",
    ".cursor/governance/qa-targets-contract.json",
    ".cursor/governance/runtime-executor.json",
    ".cursor/governance/runtime-targets-contract.json",
    ".cursor/governance/auto-fix-loop.json",
    ".cursor/governance/cost-budget.json",
    ".cursor/governance/frontend-budget.json",
    ".cursor/governance/orchestrator-preflight.json",
    ".cursor/governance/mcp-protocols.json",
    ".cursor/governance/portable-manifest.json"
)

foreach ($f in $govFiles) {
    $p = Join-Path $Root $f
    if (Test-Path $p) {
        Add-Check "Governance" $f "OK" "Presente"
    } else {
        Add-Check "Governance" $f "CRITICO" "Arquivo de governanca ausente"
    }
}

# 4. AGENTES

$agentFiles = @(
    ".cursor/agents/00-product-manager.md",
    ".cursor/agents/01-orchestrator.md",
    ".cursor/agents/02-architect.md",
    ".cursor/agents/03-backend.md",
    ".cursor/agents/04-frontend.md",
    ".cursor/agents/08b-designer.md",
    ".cursor/agents/09-rovis-be.md",
    ".cursor/agents/10-agent-scorecard.md",
    ".cursor/agents/11-ai-testing.md",
    ".cursor/agents/08c-fe-executor.md",
    ".cursor/agents/03b-be-contracts.md",
    ".cursor/agents/qa/qa-mcp.md",
    ".cursor/agents/qa/qa-setup.md",
    ".cursor/agents/qa/qa-reports.md",
    ".cursor/agents/qa/qa-gates.md"
)

foreach ($f in $agentFiles) {
    $p = Join-Path $Root $f
    if (Test-Path $p) {
        Add-Check "Agentes" $f "OK" "Presente"
    } else {
        Add-Check "Agentes" $f "AVISO" "Agente ausente"
    }
}

# 5. SCRIPTS

$scriptFiles = @(
    ".cursor/scripts/Get-RovisRouting.ps1",
    ".cursor/scripts/Check-RovisHandoff.ps1",
    ".cursor/scripts/Check-RovisStageScore.ps1",
    ".cursor/scripts/Check-RovisCloseout.ps1",
    ".cursor/scripts/Resolve-RovisQATargets.ps1",
    ".cursor/scripts/Resolve-RovisRuntimeTargets.ps1",
    ".cursor/scripts/Resolve-RovisNextAction.ps1",
    ".cursor/scripts/Run-RovisStage.ps1",
    ".cursor/scripts/Write-RovisMemory.ps1",
    ".cursor/scripts/Test-RovisGovernance.ps1",
    ".cursor/scripts/Compress-RovisMemory.ps1",
    ".cursor/scripts/Test-RovisHealth.ps1",
    ".cursor/scripts/Get-RovisQAStatus.ps1",
    ".cursor/scripts/Get-RovisQARegression.ps1",
    ".cursor/scripts/Get-RovisQAFlaky.ps1",
    ".cursor/scripts/Get-RovisQASmartTargets.ps1",
    ".cursor/scripts/Resolve-RovisQAProvider.ps1",
    ".cursor/scripts/Compress-RovisQAReports.ps1",
    ".cursor/scripts/Update-RovisSessionMetrics.ps1",
    ".cursor/scripts/Invoke-RovisAutoFix.ps1",
    ".cursor/scripts/Build-RovisCodeIndex.ps1",
    ".cursor/scripts/Search-RovisCode.ps1",
    ".cursor/scripts/Get-RovisExecutionTrace.ps1",
    ".cursor/scripts/Test-RovisVisualDiff.ps1",
    ".cursor/scripts/Test-RovisA11y.ps1",
    ".cursor/scripts/Test-RovisMigrationSafety.ps1",
    ".cursor/scripts/Test-RovisBreakingChanges.ps1",
    ".cursor/scripts/Run-RovisLoadTest.ps1",
    ".cursor/scripts/Test-RovisDepAudit.ps1",
    ".cursor/scripts/helpers/Sanitize-Unicode.ps1",
    ".cursor/scripts/Get-RovisProjectProfile.ps1",
    ".cursor/scripts/Get-RovisFixSuggestion.ps1",
    ".cursor/scripts/Get-RovisInsights.ps1",
    ".cursor/scripts/Initialize-Rovis.ps1",
    ".cursor/scripts/Reset-RovisMemory.ps1",
    ".cursor/scripts/Clear-RovisArchive.ps1",
    ".cursor/scripts/Update-RovisWorkset.ps1",
    ".cursor/scripts/Update-RovisCheckpoint.ps1"
)

foreach ($f in $scriptFiles) {
    $p = Join-Path $Root $f
    if (Test-Path $p) {
        Add-Check "Scripts" $f "OK" "Presente"
    } else {
        Add-Check "Scripts" $f "AVISO" "Script ausente"
    }
}

# 6. RULES

$rulesPath = Join-Path $Root ".cursor/rules/rovis-context.mdc"
if (Test-Path $rulesPath) {
    Add-Check "Rules" "rovis-context.mdc" "OK" "Auto-inject presente"
} else {
    Add-Check "Rules" "rovis-context.mdc" "AVISO" "Auto-inject ausente"
}

# OUTPUT

$total     = $results.Count
$okCount   = ($results | Where-Object { $_.Level -eq "OK" }).Count
$warnCount = ($results | Where-Object { $_.Level -eq "AVISO" }).Count
$critCount = ($results | Where-Object { $_.Level -eq "CRITICO" }).Count

Write-Output ""
Write-Output "======================================================"
Write-Output "           ROVIS HEALTH CHECK"
Write-Output "======================================================"
Write-Output ""

$categories = $results | ForEach-Object { $_.Cat } | Select-Object -Unique

foreach ($cat in $categories) {
    Write-Output "-- $cat --"
    $results | Where-Object { $_.Cat -eq $cat } | ForEach-Object {
        $icon = switch ($_.Level) {
            "OK"      { "[  OK   ]" }
            "AVISO"   { "[ AVISO ]" }
            "CRITICO" { "[CRITICO]" }
            default   { "[       ]" }
        }
        $short = $_.Item -replace "^\.cursor/", ""
        if ($_.Level -eq "OK") {
            Write-Output "  $icon $short"
        } else {
            Write-Output "  $icon $short"
            Write-Output "           -> $($_.Detail)"
        }
    }
    Write-Output ""
}

Write-Output "------------------------------------------------------"
Write-Output "  Total: $total  |  OK: $okCount  |  AVISO: $warnCount  |  CRITICO: $critCount"
Write-Output ""

if ($hasCritical) {
    Write-Output "  RESULTADO: CRITICO - resolver antes de operar"
    exit 1
} elseif ($warnCount -gt 0) {
    Write-Output "  RESULTADO: AVISO - sistema operacional com pontos de atencao"
    exit 0
} else {
    Write-Output "  RESULTADO: OK - sistema saudavel"
    exit 0
}
