param(
    [string]$Root = ".cursor"
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

$contractPath = Join-Path $Root "governance/closeout-contract.json"
if (-not (Test-Path $contractPath)) {
    throw "Closeout contract not found: $contractPath"
}

$contract = Get-Content $contractPath -Raw | ConvertFrom-Json
$checkpointBlock = Get-LatestHeadingBlock -Path $contract.checkpointPath
$doneBlock = Get-LatestHeadingBlock -Path $contract.donePath
$testingBlock = Get-LatestHeadingBlock -Path $contract.testingPath
$errors = New-Object System.Collections.Generic.List[string]

if ($contract.rules.latestCheckpointMustExist -and $checkpointBlock.Count -eq 0) {
    $errors.Add("No latest checkpoint block found")
}

foreach ($field in $contract.requiredCheckpointFields) {
    if ($checkpointBlock -notcontains $field) {
        $errors.Add("Checkpoint missing required field: $field")
    }
}

$checkpointDate = ""
$checkpointState = Get-FieldValue -Block $checkpointBlock -Field "Etapa:"
for ($i = 0; $i -lt $checkpointBlock.Count; $i++) {
    if ($checkpointBlock[$i] -like "Data:*") {
        $checkpointDate = $checkpointBlock[$i].Substring(5).Trim()
        break
    }
}
if ([string]::IsNullOrWhiteSpace($checkpointDate) -and $checkpointBlock.Count -gt 0 -and $checkpointBlock[0] -match '^##\s+(\d{4}-\d{2}-\d{2})') {
    $checkpointDate = $Matches[1]
}

$doneDate = ""
for ($i = 0; $i -lt $doneBlock.Count; $i++) {
    if ($doneBlock[$i] -like "Data:*") {
        $doneDate = $doneBlock[$i].Substring(5).Trim()
        break
    }
}

$testingDate = ""
for ($i = 0; $i -lt $testingBlock.Count; $i++) {
    if ($testingBlock[$i] -like "Data:*") {
        $testingDate = $testingBlock[$i].Substring(5).Trim()
        break
    }
}

if ($contract.statesRequiringDone -contains $checkpointState) {
    if ([string]::IsNullOrWhiteSpace($doneDate)) {
        $errors.Add("Done entry missing for checkpoint state $checkpointState")
    }
    elseif ($contract.rules.latestDoneMustMatchCheckpointDateWhenRequired -and $doneDate -ne $checkpointDate) {
        $errors.Add("Done entry date does not match checkpoint date ($doneDate != $checkpointDate)")
    }
}

if ($contract.statesRequiringTesting -contains $checkpointState) {
    if ([string]::IsNullOrWhiteSpace($testingDate)) {
        $errors.Add("Testing entry missing for checkpoint state $checkpointState")
    }
    elseif ($contract.rules.latestTestingMustMatchCheckpointDateWhenRequired -and $testingDate -ne $checkpointDate) {
        $errors.Add("Testing entry date does not match checkpoint date ($testingDate != $checkpointDate)")
    }
}

if ($errors.Count -gt 0) {
    Write-Output "[ROVIS CLOSEOUT CHECK] FAIL"
    $errors | ForEach-Object { Write-Output "- $_" }
    exit 1
}

Write-Output "[ROVIS CLOSEOUT CHECK] OK"
