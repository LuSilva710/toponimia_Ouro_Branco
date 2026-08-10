# Get-RovisFixSuggestion.ps1
# Recebe sintoma e busca padroes em 14-fix-patterns.md.
# Retorna match com confianca, pra agente decidir se reaproveita ou cria novo.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Symptom,
    [string]$PatternsPath = ".cursor/memory/14-fix-patterns.md",
    [int]$MaxResults      = 5
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PatternsPath)) {
    Write-Host "[SUGGEST] Sem base de padroes: $PatternsPath"
    @{ symptom=$Symptom; matches=@(); learned=$false } | ConvertTo-Json -Depth 5
    exit 0
}

$content = Get-Content $PatternsPath -Raw -Encoding UTF8

$blocks = [regex]::Matches($content, '(?ms)^### (?<id>[^\r\n]+).*?(?=^### |\z)')
if ($blocks.Count -eq 0) {
    Write-Host "[SUGGEST] Base vazia (nenhum padrao registrado ainda)"
    @{ symptom=$Symptom; matches=@(); learned=$false } | ConvertTo-Json -Depth 5
    exit 0
}

$queryWords = @($Symptom.ToLower() -split '\W+' | Where-Object { $_.Length -gt 2 })
$results = New-Object System.Collections.Generic.List[hashtable]

foreach ($b in $blocks) {
    $blockText  = $b.Value
    $id         = $b.Groups['id'].Value.Trim()
    if ($id -eq "<ID>") { continue }
    $sintomaMatch = [regex]::Match($blockText, '(?im)^- Sintoma:\s*(.+)$')
    $confiancaMatch = [regex]::Match($blockText, '(?im)^- Confianca:\s*(\w+)')
    $occMatch = [regex]::Match($blockText, '(?im)^- Ocorrencias:\s*(\d+)')
    $sintoma = if ($sintomaMatch.Success) { $sintomaMatch.Groups[1].Value.Trim().ToLower() } else { "" }

    $hits = 0
    foreach ($w in $queryWords) { if ($sintoma.Contains($w)) { $hits++ } }
    if ($hits -eq 0) { continue }

    $score = [math]::Round($hits / [math]::Max($queryWords.Count, 1), 2)
    $results.Add(@{
        id         = $id
        score      = $score
        confianca  = if ($confiancaMatch.Success) { $confiancaMatch.Groups[1].Value } else { "?" }
        ocorrencias = if ($occMatch.Success)     { [int]$occMatch.Groups[1].Value } else { 0 }
        block      = $blockText.Trim()
    })
}

$top = $results | Sort-Object -Property @{Expression="score"; Descending=$true}, @{Expression="ocorrencias"; Descending=$true} | Select-Object -First $MaxResults

$out = @{
    symptom    = $Symptom
    learned    = ($top.Count -gt 0)
    matches    = @($top)
    bestScore  = if ($top.Count -gt 0) { $top[0].score } else { 0 }
    suggestion = if ($top.Count -gt 0 -and $top[0].score -ge 0.5) { "REUSE" } else { "CREATE_NEW" }
}

$out | ConvertTo-Json -Depth 6
Write-Host ""
Write-Host "[SUGGEST] symptom='$Symptom' matches=$($top.Count) bestScore=$($out.bestScore) suggestion=$($out.suggestion)"
