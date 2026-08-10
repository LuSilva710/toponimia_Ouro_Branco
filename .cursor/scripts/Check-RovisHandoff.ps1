param(
    [string]$Root = ".cursor"
)

$ErrorActionPreference = "Stop"

$contractPath = Join-Path $Root "governance/handoff-contract.json"
$scorecardPath = Join-Path $Root "agents/10-agent-scorecard.md"

if (-not (Test-Path $contractPath)) {
    throw "Handoff contract not found: $contractPath"
}

if (-not (Test-Path $scorecardPath)) {
    throw "Scorecard file not found: $scorecardPath"
}

$contract = Get-Content $contractPath -Raw | ConvertFrom-Json
$scorecard = Get-Content $scorecardPath -Raw
$errors = New-Object System.Collections.Generic.List[string]

if ($scorecard -notmatch [regex]::Escape("[HANDOFF]")) {
    $errors.Add("Scorecard does not contain [HANDOFF] block")
}

foreach ($field in $contract.requiredHandoffFields) {
    if ($scorecard -notmatch [regex]::Escape($field)) {
        $errors.Add("Scorecard missing handoff field: $field")
    }
}

foreach ($item in $contract.requiredScorecardItems) {
    if ($scorecard -notmatch [regex]::Escape($item)) {
        $errors.Add("Scorecard missing scorecard item: $item")
    }
}

if ($errors.Count -gt 0) {
    Write-Output "[ROVIS HANDOFF CHECK] FAIL"
    $errors | ForEach-Object { Write-Output "- $_" }
    exit 1
}

Write-Output "[ROVIS HANDOFF CHECK] OK"
