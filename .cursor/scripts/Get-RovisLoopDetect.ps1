param(
    [Parameter(Mandatory = $true)]
    [string]$CurrentText,

    [string]$Root = ".",
    [int]$ThresholdPercent = 70,
    [int]$LookbackEntries = 3
)

$ErrorActionPreference = "Stop"

$historyPath = Join-Path $Root ".cursor/memory/13-session-metrics.md"

function Get-Tokens {
    param([string]$Text)
    $clean = ($Text.ToLowerInvariant() -replace "[^a-z0-9\s]", " ")
    return ($clean -split "\s+" | Where-Object { $_.Length -gt 2 })
}

function Get-Similarity {
    param([string]$A, [string]$B)
    $tokensA = Get-Tokens $A
    $tokensB = Get-Tokens $B

    if ($tokensA.Count -eq 0 -or $tokensB.Count -eq 0) { return 0 }

    $setA = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($t in $tokensA) { [void]$setA.Add($t) }

    $setB = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($t in $tokensB) { [void]$setB.Add($t) }

    $intersection = 0
    foreach ($t in $setA) {
        if ($setB.Contains($t)) { $intersection++ }
    }

    $union = $setA.Count + $setB.Count - $intersection
    if ($union -eq 0) { return 0 }

    return [int](($intersection / $union) * 100)
}

$lastEntries = @()
if (Test-Path $historyPath) {
    $lines = Get-Content $historyPath -Encoding UTF8
    $entries = @()
    $current = $null
    foreach ($line in $lines) {
        if ($line -match "^### Entry") {
            if ($current) { $entries += $current }
            $current = ""
        } elseif ($current -ne $null) {
            $current += " " + $line
        }
    }
    if ($current) { $entries += $current }
    if ($entries.Count -gt 0) {
        $take = [Math]::Min($LookbackEntries, $entries.Count)
        $lastEntries = $entries[-$take..-1]
    }
}

$maxSim = 0
$matchIndex = -1
for ($i = 0; $i -lt $lastEntries.Count; $i++) {
    $sim = Get-Similarity $CurrentText $lastEntries[$i]
    if ($sim -gt $maxSim) {
        $maxSim = $sim
        $matchIndex = $i
    }
}

$loopDetected = ($maxSim -ge $ThresholdPercent)

[pscustomobject]@{
    loopDetected      = $loopDetected
    similarityPercent = $maxSim
    threshold         = $ThresholdPercent
    matchedEntryIndex = $matchIndex
    historicalEntries = $lastEntries.Count
    recommendation    = if ($loopDetected) {
        "Abrir diagnostico do loop antes de re-executar. Verificar se a instrucao anterior foi cumprida."
    } else {
        "Sem loop detectado. Prosseguir normalmente."
    }
} | ConvertTo-Json -Depth 5
