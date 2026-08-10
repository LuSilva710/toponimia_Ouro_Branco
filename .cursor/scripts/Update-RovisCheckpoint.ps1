# Update-RovisCheckpoint.ps1
# Adiciona uma entrada de checkpoint em .cursor/memory/10-checkpoint.md (append).
# Mantem ultimas N entradas (rotaciona).

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Action,
    [string]$Agent          = "ROVIS",
    [string]$Status         = "ok",
    [string]$Files          = "",
    [string]$Notes          = "",
    [string]$CheckpointPath = ".cursor/memory/10-checkpoint.md",
    [int]$KeepLast          = 50
)

$ErrorActionPreference = "Stop"

$dir = Split-Path $CheckpointPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

$entry = @"

### $timestamp - $Agent
- Action: $Action
- Status: $Status
$(if ($Files) { "- Files: $Files" } else { '' })
$(if ($Notes) { "- Notes: $Notes" } else { '' })
"@

if (-not (Test-Path $CheckpointPath)) {
    Set-Content -Path $CheckpointPath -Value "# Checkpoint`n`nUltimas $KeepLast acoes do orchestrator e agentes.`n" -Encoding UTF8
}

Add-Content -Path $CheckpointPath -Value $entry -Encoding UTF8

# Rotacao: mantem so as ultimas N entradas
$content = Get-Content $CheckpointPath -Raw -Encoding UTF8
$entries = [regex]::Matches($content, '(?ms)(### \d{4}-\d{2}-\d{2}.+?)(?=### \d{4}-|\z)')

if ($entries.Count -gt $KeepLast) {
    $header = ($content -split '### \d{4}-\d{2}-\d{2}', 2)[0]
    $kept = $entries | Select-Object -Last $KeepLast | ForEach-Object { $_.Value.TrimEnd() }
    $newContent = $header.TrimEnd() + "`n`n" + ($kept -join "`n") + "`n"
    Set-Content -Path $CheckpointPath -Value $newContent -Encoding UTF8
    Write-Host "[CHECKPOINT] Rotacionado: mantidas ultimas $KeepLast de $($entries.Count) entradas"
}

Write-Host "[CHECKPOINT] +1 entrada | agent=$Agent action='$Action' status=$Status"
