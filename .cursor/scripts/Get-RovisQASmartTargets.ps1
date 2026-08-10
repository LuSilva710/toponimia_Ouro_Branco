# Get-RovisQASmartTargets.ps1
# Identifica features afetadas pelo diff git (HEAD~1) usando testsByContract de qa-targets-contract.json.
# Saida: smart-features.json para o engine consumir em modo smart.

[CmdletBinding()]
param(
    [string]$Base = "HEAD~1",
    [string]$ContractPath = ".cursor/governance/qa-targets-contract.json",
    [string]$OutputPath   = ".cursor/testing-module/config/smart-features.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ContractPath)) {
    Write-Host "[QA-SMART] qa-targets-contract.json nao encontrado"
    exit 1
}

$contract = Get-Content $ContractPath -Raw | ConvertFrom-Json

if (-not $contract.testsByContract) {
    Write-Host "[QA-SMART] Sem mapeamento testsByContract - rodando full"
    @{ mode = "full"; reason = "no-mapping"; features = @() } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8
    exit 0
}

try {
    $changed = git diff --name-only $Base 2>$null
}
catch {
    Write-Host "[QA-SMART] git diff falhou - rodando full"
    @{ mode = "full"; reason = "git-error"; features = @() } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8
    exit 0
}

if (-not $changed) {
    Write-Host "[QA-SMART] Sem alteracoes - rodando smoke"
    @{ mode = "smoke"; reason = "no-changes"; features = @() } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8
    exit 0
}

$affected = New-Object System.Collections.Generic.HashSet[string]
foreach ($pathChanged in $changed) {
    foreach ($entry in $contract.testsByContract.PSObject.Properties) {
        $pattern = $entry.Name
        if ($pathChanged -like $pattern) {
            foreach ($f in $entry.Value) { [void]$affected.Add($f) }
        }
    }
}

$result = [ordered]@{
    mode         = "smart"
    base         = $Base
    changedFiles = @($changed)
    features     = @($affected)
    reason       = if ($affected.Count -eq 0) { "no-mapped-features" } else { "mapped" }
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$result | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[QA-SMART] $($affected.Count) feature(s) afetada(s)"
Write-Host "[QA-SMART] Output: $OutputPath"
