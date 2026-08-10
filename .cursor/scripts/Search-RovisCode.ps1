# Search-RovisCode.ps1
# Busca RAG-lite no code-index.json: por keyword (substring no head) e/ou tags.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Query,
    [string[]]$Tags        = @(),
    [int]$MaxResults       = 15,
    [string]$IndexPath     = ".cursor/memory/cold/code-index.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $IndexPath)) {
    Write-Host "[CODE-SEARCH] Index ausente. Rode: powershell -File .cursor/scripts/Build-RovisCodeIndex.ps1"
    exit 1
}

$index = Get-Content $IndexPath -Raw | ConvertFrom-Json
$q = $Query.ToLower()

$scored = foreach ($f in $index.files) {
    $score = 0
    if ($f.path.ToLower().Contains($q)) { $score += 10 }
    if ($f.head -and $f.head.ToLower().Contains($q)) { $score += 5 }
    foreach ($t in $f.tags) {
        if ($t -eq $q) { $score += 4 }
        if ($Tags -contains $t) { $score += 3 }
    }
    if ($score -gt 0) {
        [PSCustomObject]@{
            score = $score
            path  = $f.path
            tags  = ($f.tags -join ",")
            lines = $f.lineCount
            head  = $f.head
        }
    }
}

$top = $scored | Sort-Object -Property score -Descending | Select-Object -First $MaxResults

Write-Host ""
Write-Host "[CODE-SEARCH] Query: '$Query' | Tags: $($Tags -join ',') | Resultados: $($top.Count)"
Write-Host ""
$top | Format-Table score, path, tags, lines -AutoSize | Out-String | Write-Host
