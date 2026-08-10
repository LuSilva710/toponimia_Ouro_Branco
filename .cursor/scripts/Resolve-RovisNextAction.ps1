param(
    [string]$Root = ".cursor",
    [string]$Mode = "",
    [string]$State = ""
)

$ErrorActionPreference = "Stop"

function Get-LatestHeadingBlock {
    param([string]$Path)

    if (-not (Test-Path $Path)) { return @() }
    $lines = Get-Content $Path
    if ($lines.Count -eq 0) { return @() }

    $indexes = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^## ') {
            $indexes += $i
        }
    }

    if ($indexes.Count -eq 0) { return @() }
    $start = $indexes[-1]
    return @($lines[$start..($lines.Count - 1)])
}

function Get-FieldValue {
    param(
        [string[]]$Block,
        [string]$Field
    )

    for ($i = 0; $i -lt $Block.Count; $i++) {
        if ($Block[$i] -eq $Field) {
            for ($j = $i + 1; $j -lt $Block.Count; $j++) {
                if ($Block[$j] -match '^- ') {
                    return $Block[$j].Substring(2)
                }
            }
        }
    }

    return ""
}

$runtimePath = Join-Path $Root "governance/runtime-executor.json"
if (-not (Test-Path $runtimePath)) {
    throw "Runtime executor contract not found: $runtimePath"
}

$runtime = Get-Content $runtimePath -Raw | ConvertFrom-Json
$resolvedMode = if ([string]::IsNullOrWhiteSpace($Mode)) { $runtime.defaultMode } else { $Mode }
$resolvedState = $State

if ([string]::IsNullOrWhiteSpace($resolvedState)) {
    $checkpointBlock = Get-LatestHeadingBlock -Path $runtime.checkpointPath
    $resolvedState = Get-FieldValue -Block $checkpointBlock -Field "Etapa:"
}

if ([string]::IsNullOrWhiteSpace($resolvedState)) {
    $resolvedState = "PLANNING"
}

$stateConfig = $runtime.states.$resolvedState
if (-not $stateConfig) {
    throw "Unknown runtime state: $resolvedState"
}

$nextState = if ($stateConfig.PSObject.Properties.Name -contains "nextStateByMode") {
    $mappedState = $stateConfig.nextStateByMode.$resolvedMode
    if ([string]::IsNullOrWhiteSpace($mappedState)) { $resolvedState } else { $mappedState }
} else {
    $stateConfig.nextState
}

[pscustomobject]@{
    mode = $resolvedMode
    currentState = $resolvedState
    nextAction = $stateConfig.nextAction
    nextState = $nextState
    requiredChecks = @($stateConfig.requiredChecks)
    deepPromotionEligible = [bool]$stateConfig.deepPromotionEligible
    qaHookEnabled = [bool]($stateConfig.qaHook -and $stateConfig.qaHook.enabled)
    qaHookMode = if ($stateConfig.qaHook) { $stateConfig.qaHook.runnerMode } else { "" }
} | ConvertTo-Json -Depth 6
