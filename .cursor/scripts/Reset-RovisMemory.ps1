# Reset-RovisMemory.ps1
# Reseta memoria do ROVIS no projeto atual (ou apontado).
# Sempre cria snapshot antes. Mantem governance/scripts/agentes/contratos.

[CmdletBinding()]
param(
    [ValidateSet("memory","state","all")]
    [string]$Scope        = "memory",
    [string]$Project      = ".",
    [string]$ManifestPath = ".cursor/governance/portable-manifest.json",
    [switch]$Force,
    [switch]$SkipSnapshot
)

$ErrorActionPreference = "Stop"

$projectFull = (Resolve-Path $Project).Path
Push-Location $projectFull
try {
    if (-not (Test-Path $ManifestPath)) {
        Write-Host "[RESET] Manifest ausente: $ManifestPath"
        exit 1
    }
    $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
    $scopeDef = $manifest.resetScopes.$Scope
    if (-not $scopeDef) {
        Write-Host "[RESET] Scope invalido: $Scope"
        exit 1
    }

    Write-Host ""
    Write-Host "================================================="
    Write-Host " ROVIS RESET"
    Write-Host "================================================="
    Write-Host " Project: $projectFull"
    Write-Host " Scope:   $Scope"
    Write-Host " Descr:   $($scopeDef.description)"
    Write-Host "-------------------------------------------------"

    $existing = @($scopeDef.deletePaths | Where-Object { Test-Path $_ })
    Write-Host "[RESET] Arquivos a apagar: $($existing.Count) de $($scopeDef.deletePaths.Count)"
    foreach ($p in $existing) { Write-Host "  - $p" }

    if ($existing.Count -eq 0) {
        Write-Host "[RESET] Nada para apagar"
        exit 0
    }

    if ($Scope -eq "all" -and -not $Force) {
        Write-Host ""
        Write-Host "[RESET] Scope='all' exige -Force pra confirmar"
        Write-Host "[RESET] Exemplo: .\Reset-RovisMemory.ps1 -Scope all -Force"
        exit 1
    }

    if ($manifest.rules.alwaysSnapshotBeforeReset -and -not $SkipSnapshot) {
        $ts = Get-Date -Format "yyyy-MM-dd-HHmmss"
        $snapDir = ".cursor/memory/archive/$ts-$Scope"
        New-Item -ItemType Directory -Path $snapDir -Force | Out-Null
        $snapped = 0
        foreach ($p in $existing) {
            $rel = $p -replace "^\.cursor[/\\]memory[/\\]", ""
            $dst = Join-Path $snapDir $rel
            $dstDir = Split-Path $dst -Parent
            if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
            Copy-Item -Path $p -Destination $dst -Force
            $snapped++
        }
        Write-Host "[RESET] Snapshot: $snapDir ($snapped arquivos)"
    }

    $deleted = 0
    foreach ($p in $existing) {
        try {
            Remove-Item -Path $p -Force -Recurse -ErrorAction Stop
            $deleted++
        } catch {
            Write-Host "[RESET] FALHA apagar $p : $_"
        }
    }
    Write-Host "[RESET] Apagados: $deleted"

    $seedMap = $manifest.categories.project.createFromSeed
    $reseeded = 0
    foreach ($p in $existing) {
        $relForward = $p -replace "\\", "/"
        if ($seedMap.PSObject.Properties.Name -contains $relForward) {
            $seedContent = $seedMap.$relForward
            $dstDir = Split-Path $p -Parent
            if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
            Set-Content -Path $p -Value $seedContent -Encoding UTF8
            $reseeded++
        }
    }
    if ($reseeded -gt 0) { Write-Host "[RESET] Re-seeded: $reseeded arquivos vazios" }

    Write-Host ""
    Write-Host "================================================="
    Write-Host " ROVIS RESET concluido (scope=$Scope)"
    Write-Host "================================================="
}
finally {
    Pop-Location
}
