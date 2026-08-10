# Update-RovisWorkset.ps1
# Atualiza .cursor/memory/12-active-workset.md com a tarefa em execucao.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Task,
    [string]$Mode      = "ROVIS",
    [string]$Agent     = "ROVIS",
    [string]$Stage     = "",
    [string]$Files     = "",
    [string]$Next      = "",
    [string]$WorksetPath = ".cursor/memory/12-active-workset.md"
)

$ErrorActionPreference = "Stop"

$dir = Split-Path $WorksetPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

$content = @"
# Active workset

> Atualizado: $timestamp

## Tarefa atual
$Task

## Contexto
- Mode:   $Mode
- Agent:  $Agent
- Stage:  $(if ($Stage) { $Stage } else { '(nao informado)' })

## Arquivos em foco
$(if ($Files) { ($Files -split ',' | ForEach-Object { "- $($_.Trim())" }) -join "`n" } else { '(nenhum)' })

## Proxima acao
$(if ($Next) { $Next } else { '(nao informado)' })
"@

Set-Content -Path $WorksetPath -Value $content -Encoding UTF8
Write-Host "[WORKSET] Atualizado: $WorksetPath"
Write-Host "[WORKSET] task='$Task' mode=$Mode agent=$Agent"
