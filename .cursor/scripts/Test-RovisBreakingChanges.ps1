# Test-RovisBreakingChanges.ps1
# Compara contratos com codigo, detecta campos/endpoints removidos ou alterados.
# Implementacao base: detecta diff de contratos via git e marca como breaking se reduzir superficie.

[CmdletBinding()]
param(
    [string]$ContractsPath = ".cursor/contracts",
    [string]$Base          = "HEAD~1",
    [string]$OutputPath    = ".cursor/testing-module/reports/be/breaking-changes.json"
)

$ErrorActionPreference = "Stop"

$reportDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }

if (-not (Test-Path $ContractsPath)) {
    Write-Host "[BREAKING] Sem contratos em: $ContractsPath"
    @{ generatedAt=(Get-Date).ToString("o"); breaking=@(); blocked=$false; reason="no-contracts" } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8 -Force
    exit 0
}

try {
    $changed = git diff --name-only $Base -- $ContractsPath 2>$null
}
catch {
    Write-Host "[BREAKING] git diff falhou - sem analise"
    @{ generatedAt=(Get-Date).ToString("o"); breaking=@(); blocked=$false; reason="git-error" } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8 -Force
    exit 0
}

if (-not $changed) {
    Write-Host "[BREAKING] Nenhum contrato alterado vs $Base"
    @{ generatedAt=(Get-Date).ToString("o"); breaking=@(); blocked=$false; reason="no-changes" } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8 -Force
    exit 0
}

$breaking = New-Object System.Collections.Generic.List[hashtable]

foreach ($file in $changed) {
    $oldContent = ""
    try { $oldContent = git show "$Base`:$file" 2>$null | Out-String } catch {}
    if (-not (Test-Path $file)) {
        $breaking.Add(@{ file=$file; type="contract-deleted"; severity="critical" })
        continue
    }
    $newContent = Get-Content $file -Raw -ErrorAction SilentlyContinue
    if (-not $newContent) { continue }

    $oldFields = [regex]::Matches($oldContent, '(?m)^\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:') | ForEach-Object { $_.Groups[1].Value }
    $newFields = [regex]::Matches($newContent, '(?m)^\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:') | ForEach-Object { $_.Groups[1].Value }
    $removed = @($oldFields | Where-Object { $_ -notin $newFields } | Select-Object -Unique)

    $oldEndpoints = [regex]::Matches($oldContent, '(?i)(get|post|put|patch|delete)\s+/[^\s"]+') | ForEach-Object { $_.Value }
    $newEndpoints = [regex]::Matches($newContent, '(?i)(get|post|put|patch|delete)\s+/[^\s"]+') | ForEach-Object { $_.Value }
    $removedEndpoints = @($oldEndpoints | Where-Object { $_ -notin $newEndpoints } | Select-Object -Unique)

    if ($removed.Count -gt 0) {
        $breaking.Add(@{ file=$file; type="fields-removed"; fields=$removed; severity="serious" })
    }
    if ($removedEndpoints.Count -gt 0) {
        $breaking.Add(@{ file=$file; type="endpoints-removed"; endpoints=$removedEndpoints; severity="critical" })
    }
}

$blocked = ($breaking | Where-Object { $_.severity -in @("critical","serious") }).Count -gt 0

$report = [ordered]@{
    generatedAt    = (Get-Date).ToString("o")
    base           = $Base
    contractsPath  = $ContractsPath
    filesChanged   = @($changed)
    breaking       = $breaking
    blocked        = $blocked
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[BREAKING] files=$($changed.Count) breaking=$($breaking.Count) blocked=$blocked"
Write-Host "[BREAKING] Relatorio: $OutputPath"
if ($blocked) { exit 2 }
