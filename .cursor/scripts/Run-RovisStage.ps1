param(
    [Parameter(Mandatory = $true)]
    [string]$State,

    [string]$Root = ".cursor",
    [string]$Mode = "ROVIS",
    [switch]$ApplyTransition,
    [switch]$PromoteChain,
    [switch]$EnableQaHooks,
    [string]$Task = "Runtime transition",
    [string]$ActiveAgent = "PM",
    [string]$CheckpointTitle = "",
    [ValidateSet("generate", "api", "browser", "all", "")]
    [string]$QaMode = "",
    [int]$MaxTransitions = 0
)

$ErrorActionPreference = "Stop"

function Resolve-RuntimePath {
    param(
        [string]$BaseRoot,
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    if (Test-Path $Path) {
        return $Path
    }

    return (Join-Path $BaseRoot $Path)
}

function Get-NextActionInfo {
    param(
        [string]$RuntimeRoot,
        [string]$RuntimeMode,
        [string]$CurrentState
    )

    return (powershell -ExecutionPolicy Bypass -File (Join-Path $RuntimeRoot "scripts/Resolve-RovisNextAction.ps1") -Root $RuntimeRoot -Mode $RuntimeMode -State $CurrentState | ConvertFrom-Json)
}

function Invoke-QaHook {
    param(
        [pscustomobject]$Runtime,
        [pscustomobject]$StateConfig,
        [string]$RuntimeRoot,
        [string]$RuntimeMode,
        [string]$CurrentState,
        [string]$ResolvedQaMode
    )

    if (-not $StateConfig.qaHook -or -not $StateConfig.qaHook.enabled) {
        return $null
    }

    $qaRunnerPath = Resolve-RuntimePath -BaseRoot $RuntimeRoot -Path $Runtime.defaultQaRunnerPath
    if (-not (Test-Path $qaRunnerPath)) {
        throw "QA runner not found: $qaRunnerPath"
    }

    $effectiveQaMode = if ([string]::IsNullOrWhiteSpace($ResolvedQaMode)) {
        if ([string]::IsNullOrWhiteSpace($StateConfig.qaHook.runnerMode)) {
            $Runtime.defaultQaGenerateMode
        }
        else {
            $StateConfig.qaHook.runnerMode
        }
    }
    else {
        $ResolvedQaMode
    }

    $qaArgumentList = @(
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$qaRunnerPath`"",
        "-Mode", $effectiveQaMode
    )

    if ($StateConfig.qaHook.skipBrowserInstall) {
        $qaArgumentList += "-SkipBrowserInstall"
    }

    $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("rovis-qa-hook-out-" + [System.Guid]::NewGuid().ToString("N") + ".log")
    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("rovis-qa-hook-err-" + [System.Guid]::NewGuid().ToString("N") + ".log")
    try {
        $qaProcess = Start-Process -FilePath "powershell" -ArgumentList $qaArgumentList -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $qaOutput = @()
        if (Test-Path $stdoutPath) {
            $qaOutput += Get-Content $stdoutPath
        }
        if (Test-Path $stderrPath) {
            $qaOutput += Get-Content $stderrPath
        }
        $qaSucceeded = ($qaProcess.ExitCode -eq 0)
    }
    finally {
        if (Test-Path $stdoutPath) {
            Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $stderrPath) {
            Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
        }
    }

    [pscustomobject]@{
        state = $CurrentState
        mode = $RuntimeMode
        runner = $qaRunnerPath
        qaMode = $effectiveQaMode
        success = $qaSucceeded
        blockOnFailure = [bool]$StateConfig.qaHook.blockOnFailure
        output = @($qaOutput)
    }
}

$runtimePath = Join-Path $Root "governance/runtime-executor.json"
if (-not (Test-Path $runtimePath)) {
    throw "Runtime executor contract not found: $runtimePath"
}

$runtime = Get-Content $runtimePath -Raw | ConvertFrom-Json
$stateConfig = $runtime.states.$State
if (-not $stateConfig) {
    throw "Unknown runtime state: $State"
}

$writeMemoryScriptPath = Join-Path $Root "scripts/Write-RovisMemory.ps1"
if ($ApplyTransition -and -not (Test-Path $writeMemoryScriptPath)) {
    throw "Write-RovisMemory script not found: $writeMemoryScriptPath"
}

$transitionLimit = if ($MaxTransitions -gt 0) { $MaxTransitions } else { [int]$runtime.maxAutoTransitions }
if ($transitionLimit -lt 1) {
    $transitionLimit = 1
}

$transitionRecords = New-Object System.Collections.Generic.List[object]
$qaHookResults = New-Object System.Collections.Generic.List[object]
$allExecutedChecks = New-Object System.Collections.Generic.List[string]
$currentState = $State
$appliedTransitions = 0
$stopReason = "dry_run"
$finalNextAction = $null
$finalNextState = $null

while ($true) {
    $currentConfig = $runtime.states.$currentState
    if (-not $currentConfig) {
        throw "Unknown runtime state during execution: $currentState"
    }

    $executedChecks = New-Object System.Collections.Generic.List[string]
    foreach ($rawCheckPath in @($currentConfig.requiredChecks)) {
        if ([string]::IsNullOrWhiteSpace($rawCheckPath)) { continue }

        $checkPath = Resolve-RuntimePath -BaseRoot $Root -Path $rawCheckPath
        if (-not (Test-Path $checkPath)) {
            throw "Required runtime check not found: $checkPath"
        }

        $output = powershell -ExecutionPolicy Bypass -File $checkPath
        if ($LASTEXITCODE -ne 0) {
            Write-Output "[ROVIS RUNTIME] FAIL"
            Write-Output "State: $currentState"
            Write-Output "Mode: $Mode"
            Write-Output "Failed check: $checkPath"
            $output
            exit 1
        }

        $executedChecks.Add($checkPath)
        $allExecutedChecks.Add($checkPath)
    }

    $nextAction = Get-NextActionInfo -RuntimeRoot $Root -RuntimeMode $Mode -CurrentState $currentState
    $finalNextAction = $nextAction.nextAction
    $finalNextState = $nextAction.nextState

    $qaResult = $null
    if ($EnableQaHooks -and $currentConfig.qaHook -and $currentConfig.qaHook.enabled) {
        $qaResult = Invoke-QaHook -Runtime $runtime -StateConfig $currentConfig -RuntimeRoot $Root -RuntimeMode $Mode -CurrentState $currentState -ResolvedQaMode $QaMode
        $qaHookResults.Add($qaResult)

        if ($ApplyTransition) {
            $testingBody = @"
Estado:
- $currentState
Modo:
- $Mode
QA hook:
- $($qaResult.qaMode)
Runner:
- $($qaResult.runner)
Resultado:
- $(if ($qaResult.success) { "success" } else { "fail" })
"@
            powershell -ExecutionPolicy Bypass -File $writeMemoryScriptPath -Log testing -Title "Runtime QA hook $currentState" -Body $testingBody -Agent $runtime.defaultAgent -Root $Root | Out-Null
        }

        if (-not $qaResult.success -and $qaResult.blockOnFailure) {
            Write-Output "[ROVIS RUNTIME] FAIL"
            Write-Output "State: $currentState"
            Write-Output "Mode: $Mode"
            Write-Output "QA hook blocked transition: $($qaResult.runner)"
            $qaResult.output
            exit 1
        }
    }

    $transitionRecords.Add([pscustomobject]@{
        fromState = $currentState
        nextAction = $nextAction.nextAction
        nextState = $nextAction.nextState
        executedChecks = @($executedChecks)
        qaHookMode = if ($qaResult) { $qaResult.qaMode } else { "" }
        qaHookSuccess = if ($qaResult) { [bool]$qaResult.success } else { $null }
    })

    if (-not $ApplyTransition) {
        $stopReason = "dry_run"
        break
    }

    if (-not $currentConfig.applyTransition) {
        $stopReason = "transition_disabled"
        break
    }

    $appliedTransitions += 1
    $currentState = $nextAction.nextState

    if (-not $PromoteChain) {
        $stopReason = "single_transition_applied"
        break
    }

    if ($appliedTransitions -ge $transitionLimit) {
        $stopReason = "max_transitions_reached"
        break
    }

    $nextConfig = $runtime.states.$currentState
    if (-not $nextConfig) {
        $stopReason = "next_state_missing"
        break
    }

    if (-not $nextConfig.deepPromotionEligible) {
        $stopReason = "next_state_not_eligible"
        break
    }
}

if ($ApplyTransition) {
    $resolvedFinalAction = Get-NextActionInfo -RuntimeRoot $Root -RuntimeMode $Mode -CurrentState $currentState
    $finalNextAction = $resolvedFinalAction.nextAction
    $finalNextState = $resolvedFinalAction.nextState
}

$checkpointTitleToUse = if ([string]::IsNullOrWhiteSpace($CheckpointTitle)) {
    "$($runtime.defaultCheckpointTitle) - $State para $currentState"
} else {
    $CheckpointTitle
}

if ($ApplyTransition) {
    $transitionLines = @($transitionRecords | ForEach-Object { "- $($_.fromState) -> $($_.nextState) [$($_.nextAction)]" }) -join "`n"
    $qaSummaryLines = if ($qaHookResults.Count -gt 0) {
        (@($qaHookResults | ForEach-Object { "- $($_.state): mode=$($_.qaMode) success=$($_.success)" }) -join "`n")
    }
    else {
        "- none"
    }

    $implementationBody = @"
Estado inicial:
- $State
Estado final:
- $currentState
Modo:
- $Mode
Transicoes aplicadas:
$transitionLines
Checks executados:
$((@($allExecutedChecks) | ForEach-Object { "- $_" }) -join "`n")
QA hooks:
$qaSummaryLines
Resultado:
- Runtime executor aplicou a transicao automatica com sucesso.
Motivo de parada:
- $stopReason
"@

    powershell -ExecutionPolicy Bypass -File $writeMemoryScriptPath -Log implementation -Title "Runtime transition $State -> $currentState" -Body $implementationBody -Agent $runtime.defaultAgent -Root $Root | Out-Null

    $checkpointBody = @"
Plano atual:
- $Task
Etapa:
- $currentState
Agente ativo:
- $ActiveAgent
Proxima acao:
- $finalNextAction
Modo:
- $Mode
Estado anterior:
- $State
Motivo de parada:
- $stopReason
Transicoes aplicadas:
$transitionLines
Checks executados:
$((@($allExecutedChecks) | ForEach-Object { "- $_" }) -join "`n")
QA hooks:
$qaSummaryLines
"@

    powershell -ExecutionPolicy Bypass -File $writeMemoryScriptPath -Log checkpoint -Title $checkpointTitleToUse -Body $checkpointBody -Agent $runtime.defaultAgent -Root $Root | Out-Null
}

$executedChecksSnapshot = @($allExecutedChecks.ToArray())
$transitionSnapshot = @($transitionRecords.ToArray())
$qaHookSnapshot = @($qaHookResults.ToArray())

[pscustomobject]@{
    state = $State
    finalState = $currentState
    mode = $Mode
    executedChecks = $executedChecksSnapshot
    nextAction = $finalNextAction
    nextState = $finalNextState
    transitions = $transitionSnapshot
    qaHooks = $qaHookSnapshot
    transitionApplied = [bool]$ApplyTransition
    appliedTransitions = $appliedTransitions
    promoteChain = [bool]$PromoteChain
    qaHooksEnabled = [bool]$EnableQaHooks
    checkpointTitle = $checkpointTitleToUse
    stopReason = $stopReason
    status = "ok"
} | ConvertTo-Json -Depth 8
