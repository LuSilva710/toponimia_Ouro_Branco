param(
    [string]$MemoryPath = ".cursor/memory",
    [switch]$CreateSnapshot
)

$ErrorActionPreference = "Stop"

function Get-LatestHeadingBlock {
    param(
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return @()
    }

    $lines = Get-Content $Path
    if ($lines.Count -eq 0) {
        return @()
    }

    $headingIndexes = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^## ') {
            $headingIndexes += $i
        }
    }

    if ($headingIndexes.Count -eq 0) {
        return $lines | Select-Object -Last ([Math]::Min(12, $lines.Count))
    }

    $start = $headingIndexes[-1]
    $length = $lines.Count - $start
    return $lines | Select-Object -Skip $start -First ([Math]::Min($length, 18))
}

function Get-FileLineCount {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    return (Get-Content $Path).Count
}

function Get-GoalLineFromBlock {
    param(
        [string[]]$Block
    )

    if (-not $Block -or $Block.Count -eq 0) {
        return "Sem objetivo recente registrado."
    }

    for ($i = 0; $i -lt $Block.Count; $i++) {
        if ($Block[$i] -eq "Objetivo:") {
            for ($j = $i + 1; $j -lt $Block.Count; $j++) {
                if ($Block[$j] -match '^- ') {
                    return $Block[$j].Substring(2)
                }
            }
        }
    }

    return "Sem objetivo recente registrado."
}

$indexPath = Join-Path $MemoryPath "index.md"
$sessionPath = Join-Path $MemoryPath "11-session-summary.md"
$worksetPath = Join-Path $MemoryPath "12-active-workset.md"
$archivePath = Join-Path $MemoryPath "archive"

if (-not (Test-Path $archivePath)) {
    New-Item -ItemType Directory -Path $archivePath | Out-Null
}

$trackedFiles = @(
    "00-context.md",
    "03-backlog.md",
    "04-planning-log.md",
    "06-implementation-log.md",
    "07-testing-log.md",
    "09-done.md",
    "10-checkpoint.md"
)

if ($CreateSnapshot) {
    $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $snapshotDir = Join-Path $archivePath $stamp
    New-Item -ItemType Directory -Path $snapshotDir | Out-Null
    foreach ($file in $trackedFiles) {
        $source = Join-Path $MemoryPath $file
        if (Test-Path $source) {
            Copy-Item $source (Join-Path $snapshotDir $file)
        }
    }
}

$checkpointBlock = Get-LatestHeadingBlock -Path (Join-Path $MemoryPath "10-checkpoint.md")
$planningBlock = Get-LatestHeadingBlock -Path (Join-Path $MemoryPath "04-planning-log.md")
$implementationBlock = Get-LatestHeadingBlock -Path (Join-Path $MemoryPath "06-implementation-log.md")
$testingBlock = Get-LatestHeadingBlock -Path (Join-Path $MemoryPath "07-testing-log.md")
$doneBlock = Get-LatestHeadingBlock -Path (Join-Path $MemoryPath "09-done.md")

$currentCheckpoint = if ($checkpointBlock.Count -gt 0) { $checkpointBlock[0] } else { "## Sem checkpoint recente" }
$currentGoal = Get-GoalLineFromBlock -Block $planningBlock

$indexContent = @"
# Memory Index

Leitura recomendada:
1. 00-context.md
2. 11-session-summary.md
3. 12-active-workset.md
4. 10-checkpoint.md

Memoria quente:
- 11-session-summary.md
- 12-active-workset.md
- 10-checkpoint.md

Memoria fria:
- 03-backlog.md ($(Get-FileLineCount (Join-Path $MemoryPath "03-backlog.md")) linhas)
- 04-planning-log.md ($(Get-FileLineCount (Join-Path $MemoryPath "04-planning-log.md")) linhas)
- 06-implementation-log.md ($(Get-FileLineCount (Join-Path $MemoryPath "06-implementation-log.md")) linhas)
- 07-testing-log.md ($(Get-FileLineCount (Join-Path $MemoryPath "07-testing-log.md")) linhas)
- 09-done.md ($(Get-FileLineCount (Join-Path $MemoryPath "09-done.md")) linhas)
- archive/

Ultima geracao:
- $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

$sessionContent = @"
# Session Summary

Gerado em:
- $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Checkpoint atual:
$($checkpointBlock -join "`n")

Ultimo plano relevante:
$($planningBlock -join "`n")

Ultima execucao relevante:
$($implementationBlock -join "`n")

Ultima validacao relevante:
$($testingBlock -join "`n")
"@

$worksetContent = @"
# Active Workset

Objetivo atual:
- $currentGoal

Foco operacional:
- Ler primeiro 11-session-summary.md e 10-checkpoint.md.
- Usar o checkpoint atual como ancora de estado: $currentCheckpoint
- Consultar backlog/planning/implementation apenas quando precisar de detalhe.

Riscos ativos:
- Crescimento de memoria fria aumentar custo de releitura se o compactador nao for executado periodicamente.
- Historico continua preservado; o ganho vem da leitura orientada, nao do apagamento.

Ultima validacao relevante:
$($testingBlock -join "`n")

Ultima entrega concluida:
$($doneBlock -join "`n")
"@

[System.IO.File]::WriteAllText($indexPath, $indexContent.Trim() + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($sessionPath, $sessionContent.Trim() + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($worksetPath, $worksetContent.Trim() + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

Write-Output "Memory compressed: $MemoryPath"
