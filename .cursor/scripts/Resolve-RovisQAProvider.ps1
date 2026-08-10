# Resolve-RovisQAProvider.ps1
# Resolve provider de IA seguindo a chain: codex -> gemini -> offline.
# Saida: provider-resolved.json com provider escolhido e motivo.

[CmdletBinding()]
param(
    [string]$ContractPath = ".cursor/governance/qa-targets-contract.json",
    [string]$OutputPath   = ".cursor/testing-module/config/provider-resolved.json"
)

$ErrorActionPreference = "Stop"

$contract = Get-Content $ContractPath -Raw | ConvertFrom-Json
$chain = $contract.rules.providerFallbackChain
if (-not $chain) { $chain = @("codex", "gemini", "offline") }

$chosen = $null
$reason = ""
$attempted = @()

foreach ($provider in $chain) {
    $attempted += $provider
    switch ($provider) {
        "codex" {
            if ($env:OPENAI_API_KEY) {
                $chosen = "codex"; $reason = "OPENAI_API_KEY presente"; break
            } else { continue }
        }
        "gemini" {
            if ($env:GEMINI_API_KEY) {
                $chosen = "gemini"; $reason = "GEMINI_API_KEY presente"; break
            } else { continue }
        }
        "offline" {
            $chosen = "offline"; $reason = "nenhuma chave de IA configurada"; break
        }
    }
    if ($chosen) { break }
}

$result = [ordered]@{
    resolvedAt = (Get-Date).ToString("o")
    provider   = $chosen
    reason     = $reason
    chain      = $chain
    attempted  = $attempted
    offline    = ($chosen -eq "offline")
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$result | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[QA-PROVIDER] provider=$chosen reason=$reason"
Write-Host "[QA-PROVIDER] Output: $OutputPath"
