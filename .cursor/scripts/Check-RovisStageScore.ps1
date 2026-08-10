param(
    [string]$Root = ".cursor"
)

$ErrorActionPreference = "Stop"

$stageRulesPath = Join-Path $Root "governance/stage-score-rules.json"
$scorecardPath = Join-Path $Root "agents/10-agent-scorecard.md"
$stateMachinePath = Join-Path $Root "governance/state-machine.md"
$handoffContractPath = Join-Path $Root "governance/handoff-contract.json"

if (-not (Test-Path $stageRulesPath)) {
    throw "Stage score rules not found: $stageRulesPath"
}

if (-not (Test-Path $scorecardPath)) {
    throw "Scorecard file not found: $scorecardPath"
}

if (-not (Test-Path $stateMachinePath)) {
    throw "State machine not found: $stateMachinePath"
}

if (-not (Test-Path $handoffContractPath)) {
    throw "Handoff contract not found: $handoffContractPath"
}

$rules = Get-Content $stageRulesPath -Raw | ConvertFrom-Json
$scorecard = Get-Content $scorecardPath -Raw
$stateMachine = Get-Content $stateMachinePath -Raw
$handoffContract = Get-Content $handoffContractPath -Raw | ConvertFrom-Json
$errors = New-Object System.Collections.Generic.List[string]

foreach ($stage in $rules.stages) {
    if ($stateMachine -notmatch [regex]::Escape($stage.state)) {
        $errors.Add("Stage score rules reference unknown state: $($stage.state)")
    }

    foreach ($item in $stage.requiredScorecardItems) {
        if ($scorecard -notmatch [regex]::Escape($item)) {
            $errors.Add("Scorecard missing required stage item for $($stage.state): $item")
        }
    }

    if ($stage.requiresHandoff) {
        foreach ($field in $handoffContract.requiredHandoffFields) {
            if ($scorecard -notmatch [regex]::Escape($field)) {
                $errors.Add("Scorecard missing handoff field required by $($stage.state): $field")
            }
        }
    }

    if ($stage.requiresTestValidation -and ($stage.requiredScorecardItems -notcontains "test_validation_executed: ok|fail")) {
        $errors.Add("Stage requires test validation but does not declare test_validation_executed: $($stage.state)")
    }
}

if ($errors.Count -gt 0) {
    Write-Output "[ROVIS STAGE SCORE CHECK] FAIL"
    $errors | ForEach-Object { Write-Output "- $_" }
    exit 1
}

Write-Output "[ROVIS STAGE SCORE CHECK] OK"
