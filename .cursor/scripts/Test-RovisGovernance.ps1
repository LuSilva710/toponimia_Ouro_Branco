param(
    [string]$Root = ".cursor"
)

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$states = @(
    "INTAKE", "PLANNING", "AWAITING_APPROVAL", "ARCHITECTING",
    "CONTRACT_READY", "BACKEND_IMPLEMENTING", "FRONTEND_IMPLEMENTING",
    "VALIDATING", "REVIEWING", "DONE", "QA_ONLY", "BLOCKED"
)
$requiredModes = @("ROVIS", "ROVIS-FE", "ROVIS-BE", "QA_ONLY")

$requiredFiles = @(
    (Join-Path $Root "bootstrap.md"),
    (Join-Path $Root "init.md"),
    (Join-Path $Root "governance/state-machine.md"),
    (Join-Path $Root "governance/memory-contract.md"),
    (Join-Path $Root "governance/mode-manifest.json"),
    (Join-Path $Root "governance/intent-router.md"),
    (Join-Path $Root "governance/agent-capabilities.json"),
    (Join-Path $Root "governance/handoff-contract.json"),
    (Join-Path $Root "governance/stage-score-rules.json"),
    (Join-Path $Root "governance/closeout-contract.json"),
    (Join-Path $Root "governance/qa-targets-contract.json"),
    (Join-Path $Root "governance/runtime-executor.json"),
    (Join-Path $Root "governance/runtime-targets-contract.json"),
    (Join-Path $Root "agents/00-product-manager.md"),
    (Join-Path $Root "agents/01-orchestrator.md"),
    (Join-Path $Root "agents/10-agent-scorecard.md"),
    (Join-Path $Root "memory/index.md"),
    (Join-Path $Root "memory/11-session-summary.md"),
    (Join-Path $Root "memory/12-active-workset.md"),
    (Join-Path $Root "scripts/Get-RovisRouting.ps1"),
    (Join-Path $Root "scripts/Check-RovisHandoff.ps1"),
    (Join-Path $Root "scripts/Check-RovisStageScore.ps1"),
    (Join-Path $Root "scripts/Check-RovisCloseout.ps1"),
    (Join-Path $Root "scripts/Resolve-RovisRuntimeTargets.ps1"),
    (Join-Path $Root "scripts/Resolve-RovisQATargets.ps1"),
    (Join-Path $Root "scripts/Resolve-RovisNextAction.ps1"),
    (Join-Path $Root "scripts/Run-RovisStage.ps1")
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $errors.Add("Missing required file: $file")
    }
}

$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
Get-ChildItem -Path (Join-Path $Root "memory") -Filter *.md | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    try {
        [void]$utf8Strict.GetString($bytes)
    }
    catch {
        $errors.Add("Memory file is not valid UTF-8: $($_.Name)")
    }
}

$bootstrapPath = Join-Path $Root "bootstrap.md"
$bootstrap = if (Test-Path $bootstrapPath) { Get-Content $bootstrapPath -Raw } else { "" }
foreach ($state in $states) {
    if ($bootstrap -notmatch [regex]::Escape($state)) {
        $errors.Add("Canonical state missing in bootstrap: $state")
    }
}

if ($bootstrap -match "(?m)^- (PLANEJAMENTO|FINALIZADO|BACKEND_EXECUTANDO|FRONTEND_EXECUTANDO)$") {
    $errors.Add("Bootstrap contains deprecated state alias")
}

foreach ($requiredMode in $requiredModes) {
    if ($bootstrap -notmatch [regex]::Escape($requiredMode)) {
        $errors.Add("Mode missing in bootstrap: $requiredMode")
    }
}

$manifestPath = Join-Path $Root "governance/mode-manifest.json"
$capabilitiesPath = Join-Path $Root "governance/agent-capabilities.json"
$manifest = $null
if (Test-Path $manifestPath) {
    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        foreach ($requiredMode in $requiredModes) {
            $mode = $manifest.modes | Where-Object { $_.id -eq $requiredMode } | Select-Object -First 1
            if (-not $mode) {
                $errors.Add("Mode missing in manifest: $requiredMode")
                continue
            }

            if (-not $mode.agentFile) {
                $errors.Add("Mode has no agentFile in manifest: $requiredMode")
            }
            elseif (-not (Test-Path $mode.agentFile)) {
                $errors.Add("Mode agentFile not found: $($mode.agentFile)")
            }

            if (-not $mode.activationCommands -or $mode.activationCommands.Count -lt 1) {
                $errors.Add("Mode has no activationCommands: $requiredMode")
            }
        }
    }
    catch {
        $errors.Add("Invalid mode manifest JSON: $manifestPath")
    }
}

if (Test-Path $capabilitiesPath) {
    try {
        $capabilities = Get-Content $capabilitiesPath -Raw | ConvertFrom-Json
        $requiredAgents = @("PM", "ROVIS", "ROVIS_FE", "ROVIS_BE", "AI_TESTING")

        foreach ($requiredAgent in $requiredAgents) {
            $agent = $capabilities.agents | Where-Object { $_.id -eq $requiredAgent } | Select-Object -First 1
            if (-not $agent) {
                $errors.Add("Agent missing in capabilities: $requiredAgent")
                continue
            }

            if (-not $agent.scope -or $agent.scope.Count -lt 1) {
                $errors.Add("Agent has no scope in capabilities: $requiredAgent")
            }

            if (-not $agent.requiredReads -or $agent.requiredReads.Count -lt 1) {
                $errors.Add("Agent has no requiredReads in capabilities: $requiredAgent")
            }
            else {
                foreach ($requiredRead in $agent.requiredReads) {
                    if ($requiredRead -like "*`**") {
                        continue
                    }
                    if (-not (Test-Path $requiredRead)) {
                        $errors.Add("Capability requiredRead not found for ${requiredAgent}: $requiredRead")
                    }
                }
            }

            if (-not $agent.gates -or $agent.gates.Count -lt 1) {
                $errors.Add("Agent has no gates in capabilities: $requiredAgent")
            }
        }

        foreach ($requiredMode in $requiredModes) {
            $binding = $capabilities.modeBindings | Where-Object { $_.mode -eq $requiredMode } | Select-Object -First 1
            if (-not $binding) {
                $errors.Add("Mode binding missing in capabilities: $requiredMode")
                continue
            }

            if (-not $binding.primaryAgent) {
                $errors.Add("Mode binding has no primaryAgent: $requiredMode")
            }

            if (-not $binding.allowedAgents -or $binding.allowedAgents.Count -lt 1) {
                $errors.Add("Mode binding has no allowedAgents: $requiredMode")
            }

            if ($manifest) {
                $modeManifest = $manifest.modes | Where-Object { $_.id -eq $requiredMode } | Select-Object -First 1
                if ($modeManifest) {
                    $expectedAgent = switch ($requiredMode) {
                        "ROVIS" { "ROVIS" }
                        "ROVIS-FE" { "ROVIS_FE" }
                        "ROVIS-BE" { "ROVIS_BE" }
                        "QA_ONLY" { "AI_TESTING" }
                        default { "" }
                    }

                    if ($expectedAgent -and $binding.primaryAgent -ne $expectedAgent) {
                        $errors.Add("Mode binding primaryAgent mismatch for ${requiredMode}: expected $expectedAgent")
                    }
                }
            }
        }
    }
    catch {
        $errors.Add("Invalid agent capabilities JSON: $capabilitiesPath")
    }
}

$routingScriptPath = Join-Path $Root "scripts/Get-RovisRouting.ps1"
if (Test-Path $routingScriptPath) {
    try {
        $defaultRouting = powershell -ExecutionPolicy Bypass -File $routingScriptPath -Text "como ativar o modo rovis?" | ConvertFrom-Json
        if ($defaultRouting.intake -ne "PM-LIGHT") {
            $errors.Add("Routing smoke test failed for planning/intake classification")
        }

        $modeRouting = powershell -ExecutionPolicy Bypass -File $routingScriptPath -Text "modo ROVIS-FE" | ConvertFrom-Json
        if ($modeRouting.mode -ne "ROVIS-FE") {
            $errors.Add("Routing smoke test failed for mode ROVIS-FE")
        }

        $testingRouting = powershell -ExecutionPolicy Bypass -File $routingScriptPath -Text "testa o sistema agora" | ConvertFrom-Json
        if (-not $testingRouting.activateTesting -or $testingRouting.state -ne "QA_ONLY") {
            $errors.Add("Routing smoke test failed for testing intent")
        }
    }
    catch {
        $errors.Add("Routing smoke test failed: $($_.Exception.Message)")
    }
}

$intentRouterPath = Join-Path $Root "governance/intent-router.md"
$intentRouter = if (Test-Path $intentRouterPath) { Get-Content $intentRouterPath -Raw } else { "" }
if ($intentRouter -notmatch [regex]::Escape("Get-RovisRouting.ps1")) {
    $warnings.Add("Intent router does not reference Get-RovisRouting.ps1")
}

$orchestratorPath = Join-Path $Root "agents/01-orchestrator.md"
$orchestrator = if (Test-Path $orchestratorPath) { Get-Content $orchestratorPath -Raw } else { "" }
if ($orchestrator -notmatch [regex]::Escape("agent-capabilities.json")) {
    $errors.Add("Orchestrator does not reference agent-capabilities.json")
}
if ($orchestrator -notmatch [regex]::Escape("handoff-contract.json")) {
    $errors.Add("Orchestrator does not reference handoff-contract.json")
}
if ($orchestrator -notmatch [regex]::Escape("stage-score-rules.json")) {
    $errors.Add("Orchestrator does not reference stage-score-rules.json")
}
if ($orchestrator -notmatch [regex]::Escape("closeout-contract.json")) {
    $errors.Add("Orchestrator does not reference closeout-contract.json")
}
if ($orchestrator -notmatch [regex]::Escape("qa-targets-contract.json")) {
    $errors.Add("Orchestrator does not reference qa-targets-contract.json")
}
if ($orchestrator -notmatch [regex]::Escape("runtime-executor.json")) {
    $errors.Add("Orchestrator does not reference runtime-executor.json")
}
if ($orchestrator -notmatch [regex]::Escape("runtime-targets-contract.json")) {
    $errors.Add("Orchestrator does not reference runtime-targets-contract.json")
}

$resolveRuntimeTargetsScriptPath = Join-Path $Root "scripts/Resolve-RovisRuntimeTargets.ps1"
if (Test-Path $resolveRuntimeTargetsScriptPath) {
    try {
        $resolvedRuntimeTargets = powershell -ExecutionPolicy Bypass -File $resolveRuntimeTargetsScriptPath -Root $Root | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($resolvedRuntimeTargets.backendUrl)) {
            $errors.Add("Runtime target resolver did not resolve backendUrl")
        }
        if ([string]::IsNullOrWhiteSpace($resolvedRuntimeTargets.frontendUrl)) {
            $errors.Add("Runtime target resolver did not resolve frontendUrl")
        }
        if (-not $resolvedRuntimeTargets.sourceOfTruth) {
            $errors.Add("Runtime target resolver did not expose sourceOfTruth")
        }
    }
    catch {
        $errors.Add("Runtime target resolver smoke test failed: $($_.Exception.Message)")
    }
}

$handoffScriptPath = Join-Path $Root "scripts/Check-RovisHandoff.ps1"
if (Test-Path $handoffScriptPath) {
    try {
        $handoffCheck = powershell -ExecutionPolicy Bypass -File $handoffScriptPath
        if ($handoffCheck -notcontains "[ROVIS HANDOFF CHECK] OK") {
            $errors.Add("Handoff smoke check failed")
        }
    }
    catch {
        $errors.Add("Handoff smoke test failed: $($_.Exception.Message)")
    }
}

$stageScoreScriptPath = Join-Path $Root "scripts/Check-RovisStageScore.ps1"
if (Test-Path $stageScoreScriptPath) {
    try {
        $stageScoreCheck = powershell -ExecutionPolicy Bypass -File $stageScoreScriptPath
        if ($stageScoreCheck -notcontains "[ROVIS STAGE SCORE CHECK] OK") {
            $errors.Add("Stage score smoke check failed")
        }
    }
    catch {
        $errors.Add("Stage score smoke test failed: $($_.Exception.Message)")
    }
}

$closeoutScriptPath = Join-Path $Root "scripts/Check-RovisCloseout.ps1"
if (Test-Path $closeoutScriptPath) {
    try {
        $closeoutCheck = powershell -ExecutionPolicy Bypass -File $closeoutScriptPath
        if ($closeoutCheck -notcontains "[ROVIS CLOSEOUT CHECK] OK") {
            $errors.Add("Closeout smoke check failed")
        }
    }
    catch {
        $errors.Add("Closeout smoke test failed: $($_.Exception.Message)")
    }
}

$resolveQaTargetsScriptPath = Join-Path $Root "scripts/Resolve-RovisQATargets.ps1"
if (Test-Path $resolveQaTargetsScriptPath) {
    try {
        $resolvedQaTargets = powershell -ExecutionPolicy Bypass -File $resolveQaTargetsScriptPath | ConvertFrom-Json
        if (-not $resolvedQaTargets.resolvedTargetsPath -or -not (Test-Path $resolvedQaTargets.resolvedTargetsPath)) {
            $errors.Add("QA target resolver did not produce resolved targets file")
        }
        if (-not $resolvedQaTargets.resolvedFeaturesPath -or -not (Test-Path $resolvedQaTargets.resolvedFeaturesPath)) {
            $errors.Add("QA target resolver did not produce resolved features file")
        }
    }
    catch {
        $errors.Add("QA target resolver smoke test failed: $($_.Exception.Message)")
    }
}

$resolveNextActionScriptPath = Join-Path $Root "scripts/Resolve-RovisNextAction.ps1"
if (Test-Path $resolveNextActionScriptPath) {
    try {
        $nextAction = powershell -ExecutionPolicy Bypass -File $resolveNextActionScriptPath -Root $Root -Mode "ROVIS" -State "PLANNING" | ConvertFrom-Json
        if ($nextAction.nextAction -ne "await_approval" -or $nextAction.nextState -ne "AWAITING_APPROVAL") {
            $errors.Add("Runtime next-action smoke test failed for PLANNING")
        }

        $backendNextAction = powershell -ExecutionPolicy Bypass -File $resolveNextActionScriptPath -Root $Root -Mode "ROVIS" -State "BACKEND_IMPLEMENTING" | ConvertFrom-Json
        if (-not $backendNextAction.deepPromotionEligible -or -not $backendNextAction.qaHookEnabled -or $backendNextAction.qaHookMode -ne "api") {
            $errors.Add("Runtime next-action metadata smoke test failed for BACKEND_IMPLEMENTING")
        }
    }
    catch {
        $errors.Add("Runtime next-action smoke test failed: $($_.Exception.Message)")
    }
}

$runStageScriptPath = Join-Path $Root "scripts/Run-RovisStage.ps1"
if (Test-Path $runStageScriptPath) {
    try {
        $runtimeStage = powershell -ExecutionPolicy Bypass -File $runStageScriptPath -Root $Root -Mode "ROVIS" -State "PLANNING" | ConvertFrom-Json
        if ($runtimeStage.status -ne "ok" -or $runtimeStage.nextState -ne "AWAITING_APPROVAL") {
            $errors.Add("Runtime stage smoke test failed for PLANNING")
        }
    }
    catch {
        $errors.Add("Runtime stage smoke test failed: $($_.Exception.Message)")
    }
}

try {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("rovis-runtime-smoke-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempDir "memory") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempDir "scripts") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempDir "governance") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempDir "testing-module/scripts") -Force | Out-Null

    Copy-Item (Join-Path $Root "scripts/Run-RovisStage.ps1") (Join-Path $tempDir "scripts/Run-RovisStage.ps1")
    Copy-Item (Join-Path $Root "scripts/Resolve-RovisNextAction.ps1") (Join-Path $tempDir "scripts/Resolve-RovisNextAction.ps1")
    Copy-Item (Join-Path $Root "scripts/Write-RovisMemory.ps1") (Join-Path $tempDir "scripts/Write-RovisMemory.ps1")
    Copy-Item (Join-Path $Root "scripts/Check-RovisStageScore.ps1") (Join-Path $tempDir "scripts/Check-RovisStageScore.ps1")
    Copy-Item (Join-Path $Root "scripts/Check-RovisCloseout.ps1") (Join-Path $tempDir "scripts/Check-RovisCloseout.ps1")
    Copy-Item (Join-Path $Root "governance/runtime-executor.json") (Join-Path $tempDir "governance/runtime-executor.json")
    Copy-Item (Join-Path $Root "agents/10-agent-scorecard.md") (Join-Path $tempDir "agents-scorecard.md")
    Set-Content -Path (Join-Path $tempDir "memory/06-implementation-log.md") -Value "# Implementation Log`n" -Encoding utf8
    Set-Content -Path (Join-Path $tempDir "memory/07-testing-log.md") -Value "# Testing Log`n" -Encoding utf8
    Set-Content -Path (Join-Path $tempDir "memory/10-checkpoint.md") -Value "# Checkpoint`n" -Encoding utf8

    $runtimeText = Get-Content (Join-Path $tempDir "governance/runtime-executor.json") -Raw
    $runtimeText = $runtimeText -replace "\.cursor/memory/10-checkpoint\.md", "memory/10-checkpoint.md"
    $runtimeText = $runtimeText -replace "\.cursor/memory/06-implementation-log\.md", "memory/06-implementation-log.md"
    $runtimeText = $runtimeText -replace "\.cursor/memory/07-testing-log\.md", "memory/07-testing-log.md"
    $runtimeText = $runtimeText -replace "\.cursor/scripts/Check-RovisStageScore\.ps1", "scripts/Check-RovisStageScore.ps1"
    $runtimeText = $runtimeText -replace "\.cursor/scripts/Check-RovisCloseout\.ps1", "scripts/Check-RovisCloseout.ps1"
    $runtimeText = $runtimeText -replace "\.cursor/testing-module/scripts/Run-AIEngine\.ps1", "testing-module/scripts/Run-AIEngine.ps1"
    Set-Content -Path (Join-Path $tempDir "governance/runtime-executor.json") -Value $runtimeText -Encoding utf8

    $stageCheckStub = @"
Write-Output "[ROVIS STAGE SCORE CHECK] OK"
"@
    Set-Content -Path (Join-Path $tempDir "scripts/Check-RovisStageScore.ps1") -Value $stageCheckStub -Encoding utf8

    $closeoutCheckStub = @"
Write-Output "[ROVIS CLOSEOUT CHECK] OK"
"@
    Set-Content -Path (Join-Path $tempDir "scripts/Check-RovisCloseout.ps1") -Value $closeoutCheckStub -Encoding utf8

    $qaRunnerStub = @"
param(
    [string]`$Mode = "generate",
    [switch]`$SkipBrowserInstall
)
Write-Output "[ROVIS AI ENGINE STUB] mode=`$Mode skipBrowserInstall=`$SkipBrowserInstall"
exit 0
"@
    Set-Content -Path (Join-Path $tempDir "testing-module/scripts/Run-AIEngine.ps1") -Value $qaRunnerStub -Encoding utf8

    $runtimeApplied = powershell -ExecutionPolicy Bypass -File (Join-Path $tempDir "scripts/Run-RovisStage.ps1") -Root $tempDir -Mode "ROVIS" -State "PLANNING" -ApplyTransition -Task "Runtime smoke transition" -ActiveAgent "PM" | ConvertFrom-Json
    if ($runtimeApplied.status -ne "ok" -or $runtimeApplied.transitionApplied -ne $true -or $runtimeApplied.finalState -ne "AWAITING_APPROVAL") {
        $errors.Add("Runtime applied-transition smoke test failed")
    }

    $tempCheckpoint = Get-Content (Join-Path $tempDir "memory/10-checkpoint.md") -Raw
    if ($tempCheckpoint -notmatch [regex]::Escape("AWAITING_APPROVAL")) {
        $errors.Add("Runtime applied-transition did not update checkpoint state")
    }

    $runtimeChain = powershell -ExecutionPolicy Bypass -File (Join-Path $tempDir "scripts/Run-RovisStage.ps1") -Root $tempDir -Mode "ROVIS" -State "BACKEND_IMPLEMENTING" -ApplyTransition -PromoteChain -EnableQaHooks -Task "Runtime smoke chain" -ActiveAgent "PM" | ConvertFrom-Json
    if ($runtimeChain.status -ne "ok" -or $runtimeChain.finalState -ne "DONE" -or $runtimeChain.appliedTransitions -lt 3) {
        $errors.Add("Runtime deep-promotion smoke test failed")
    }

    if ($runtimeChain.qaHooks.Count -lt 1 -or $runtimeChain.qaHooks[0].qaMode -ne "api" -or -not $runtimeChain.qaHooks[0].success) {
        $errors.Add("Runtime QA hook smoke test failed")
    }

    $tempTesting = Get-Content (Join-Path $tempDir "memory/07-testing-log.md") -Raw
    if ($tempTesting -notmatch [regex]::Escape("Runtime QA hook BACKEND_IMPLEMENTING")) {
        $errors.Add("Runtime QA hook did not update testing log")
    }
}
catch {
    $errors.Add("Runtime applied-transition smoke test failed: $($_.Exception.Message)")
}
finally {
    if ($tempDir -and (Test-Path $tempDir)) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($errors.Count -gt 0) {
    Write-Output "[ROVIS GOVERNANCE CHECK] FAIL"
    $errors | ForEach-Object { Write-Output "- $_" }
    exit 1
}

Write-Output "[ROVIS GOVERNANCE CHECK] OK"
if ($warnings.Count -gt 0) {
    $warnings | ForEach-Object { Write-Output "[warning] $_" }
}
