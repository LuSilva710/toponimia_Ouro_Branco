# Test-RovisDepAudit.ps1
# Roda npm audit (se disponivel) e gera relatorio padronizado.

[CmdletBinding()]
param(
    [string]$ProjectPath = ".",
    [string]$OutputPath  = ".cursor/testing-module/reports/be/dep-audit.json",
    [int]$MaxHigh        = 0,
    [int]$MaxCritical    = 0
)

$ErrorActionPreference = "Continue"

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$pkgPath = Join-Path $ProjectPath "package.json"
if (-not (Test-Path $pkgPath)) {
    Write-Host "[DEP-AUDIT] Sem package.json em $ProjectPath - skipping"
    @{ generatedAt=(Get-Date).ToString("o"); skipped=$true; reason="no-package-json" } |
        ConvertTo-Json | Set-Content -Path $OutputPath -Encoding UTF8 -Force
    exit 0
}

Push-Location $ProjectPath
try {
    $raw = npm audit --json 2>$null | Out-String
} catch {
    $raw = ""
}
Pop-Location

if (-not $raw) {
    Write-Host "[DEP-AUDIT] npm audit nao retornou dados"
    @{ generatedAt=(Get-Date).ToString("o"); skipped=$true; reason="npm-audit-empty" } |
        ConvertTo-Json | Set-Content -Path $OutputPath -Encoding UTF8 -Force
    exit 0
}

try {
    $audit = $raw | ConvertFrom-Json
} catch {
    Write-Host "[DEP-AUDIT] npm audit retornou JSON invalido"
    exit 0
}

$vulns = $audit.metadata.vulnerabilities
$crit  = if ($vulns.critical) { [int]$vulns.critical } else { 0 }
$high  = if ($vulns.high)     { [int]$vulns.high     } else { 0 }
$mod   = if ($vulns.moderate) { [int]$vulns.moderate } else { 0 }
$low   = if ($vulns.low)      { [int]$vulns.low      } else { 0 }

$blocked = ($crit -gt $MaxCritical) -or ($high -gt $MaxHigh)

$report = [ordered]@{
    generatedAt   = (Get-Date).ToString("o")
    projectPath   = (Resolve-Path $ProjectPath).Path
    vulnerabilities = @{
        critical = $crit
        high     = $high
        moderate = $mod
        low      = $low
    }
    thresholds    = @{ maxCritical = $MaxCritical; maxHigh = $MaxHigh }
    blocked       = $blocked
}

$report | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8
Write-Host "[DEP-AUDIT] critical=$crit high=$high moderate=$mod low=$low blocked=$blocked"
Write-Host "[DEP-AUDIT] Relatorio: $OutputPath"
if ($blocked) { exit 2 }
