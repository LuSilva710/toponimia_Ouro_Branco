# Initialize-Rovis.ps1
# Instala ROVIS num projeto destino (copia independente).
# Uso: .\Initialize-Rovis.ps1 -Project "C:\meu-app"

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Project,
    [string]$Source       = $null,
    [string]$ManifestPath = $null,
    [switch]$Force,
    [switch]$SkipProfile,
    [switch]$SkipHealth,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $Source) {
    $scriptRoot = Split-Path -Parent $PSCommandPath
    $Source = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
}
if (-not $ManifestPath) {
    $ManifestPath = Join-Path $Source ".cursor\governance\portable-manifest.json"
}

if (-not (Test-Path $Source))       { Write-Host "[INIT] Fonte invalida: $Source"; exit 1 }
if (-not (Test-Path $ManifestPath)) { Write-Host "[INIT] Manifest ausente: $ManifestPath"; exit 1 }

if (-not (Test-Path $Project)) {
    if ($Force -or $DryRun) {
        if (-not $DryRun) { New-Item -ItemType Directory -Path $Project -Force | Out-Null }
        Write-Host "[INIT] Diretorio criado: $Project"
    } else {
        Write-Host "[INIT] Projeto nao existe: $Project (use -Force pra criar)"
        exit 1
    }
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
Write-Host ""
Write-Host "================================================="
Write-Host " ROVIS INSTALL"
Write-Host "================================================="
Write-Host " Source:  $Source"
Write-Host " Project: $Project"
Write-Host " DryRun:  $DryRun"
Write-Host "-------------------------------------------------"

$existingCursor = Join-Path $Project ".cursor"
if ((Test-Path $existingCursor) -and -not $Force -and -not $DryRun) {
    Write-Host "[INIT] .cursor ja existe em $Project"
    Write-Host "[INIT] Use -Force pra sobrescrever core (template/project preservados)"
    exit 1
}

$globalIgnoreFragments = @("node_modules", "\.git\", "/.git/", "dist\", "build\", "\.next\", "coverage\")

function Test-Ignored {
    param([string]$Path)
    foreach ($frag in $globalIgnoreFragments) {
        if ($Path -match [regex]::Escape($frag)) { return $true }
    }
    return $false
}

function Copy-ByPattern {
    param([string]$Pattern, [string]$From, [string]$To)
    $base = Join-Path $From ".cursor"
    $rel  = $Pattern -replace "^\.cursor[/\\]?", ""
    if ($rel -eq ".keep") { return 0 }

    $isGlob = $rel -match "\*"
    if ($isGlob) {
        $cleanBase = $rel -replace "[/\\]\*\*.*$", "" -replace "[/\\]\*.*$", ""
        $absBase = Join-Path $base $cleanBase
        if (-not (Test-Path $absBase)) { return 0 }
        $files = Get-ChildItem -Path $absBase -Recurse -File -ErrorAction SilentlyContinue
        $count = 0
        foreach ($f in $files) {
            if (Test-Ignored $f.FullName) { continue }
            $relPath = $f.FullName.Substring($base.Length).TrimStart('\','/')
            $dst = Join-Path (Join-Path $To ".cursor") $relPath
            $dstDir = Split-Path $dst -Parent
            if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
            if (-not $DryRun) { Copy-Item -Path $f.FullName -Destination $dst -Force }
            $count++
        }
        return $count
    }
    else {
        $src = Join-Path $base $rel
        if (-not (Test-Path $src)) { return 0 }
        $dst = Join-Path (Join-Path $To ".cursor") $rel
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        if (-not $DryRun) { Copy-Item -Path $src -Destination $dst -Force }
        return 1
    }
}

# 1. Core
Write-Host "[INIT] Copiando CORE..."
$coreCount = 0
foreach ($p in $manifest.categories.core.paths) {
    $coreCount += Copy-ByPattern -Pattern $p -From $Source -To $Project
}
Write-Host "[INIT] CORE: $coreCount arquivos"

# 2. Template (so se ainda nao existir)
Write-Host "[INIT] Copiando TEMPLATE (so onde ausente)..."
$templateCount = 0
foreach ($p in $manifest.categories.template.paths) {
    $rel  = $p -replace "^\.cursor[/\\]?", ""
    $base = Join-Path $Source ".cursor"
    $isGlob = $rel -match "\*"
    if ($isGlob) {
        $cleanBase = $rel -replace "[/\\]\*\*.*$", "" -replace "[/\\]\*.*$", ""
        $absBase = Join-Path $base $cleanBase
        if (-not (Test-Path $absBase)) { continue }
        $files = Get-ChildItem -Path $absBase -Recurse -File -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            if (Test-Ignored $f.FullName) { continue }
            $relPath = $f.FullName.Substring($base.Length).TrimStart('\','/')
            $dst = Join-Path (Join-Path $Project ".cursor") $relPath
            if (Test-Path $dst) { continue }
            $dstDir = Split-Path $dst -Parent
            if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
            if (-not $DryRun) { Copy-Item -Path $f.FullName -Destination $dst -Force }
            $templateCount++
        }
    } else {
        $src = Join-Path $base $rel
        $dst = Join-Path (Join-Path $Project ".cursor") $rel
        if ((Test-Path $dst) -or -not (Test-Path $src)) { continue }
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        if (-not $DryRun) { Copy-Item -Path $src -Destination $dst -Force }
        $templateCount++
    }
}
Write-Host "[INIT] TEMPLATE: $templateCount arquivos"

# 3. Project (vazios + seeds)
Write-Host "[INIT] Criando estrutura PROJECT..."
foreach ($d in $manifest.categories.project.createEmpty) {
    $dst = Join-Path $Project $d
    if (-not (Test-Path $dst) -and -not $DryRun) {
        New-Item -ItemType Directory -Path $dst -Force | Out-Null
    }
}
foreach ($prop in $manifest.categories.project.createFromSeed.PSObject.Properties) {
    $dst = Join-Path $Project $prop.Name
    if (Test-Path $dst) { continue }
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir) -and -not $DryRun) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    if (-not $DryRun) { Set-Content -Path $dst -Value $prop.Value -Encoding UTF8 }
}
Write-Host "[INIT] PROJECT: estrutura criada"

if ($DryRun) {
    Write-Host ""
    Write-Host "[INIT] Dry-run concluido. Nada foi escrito."
    exit 0
}

# 4. Profile + Health
Push-Location $Project
try {
    if ($manifest.rules.runProfileAfterInstall -and -not $SkipProfile) {
        Write-Host "[INIT] Rodando project profile..."
        & powershell -ExecutionPolicy Bypass -File ".\.cursor\scripts\Get-RovisProjectProfile.ps1" 2>&1 | Out-Null
    }
    if ($manifest.rules.runHealthCheckAfterInstall -and -not $SkipHealth) {
        Write-Host "[INIT] Rodando health check..."
        $healthOut = & powershell -ExecutionPolicy Bypass -File ".\.cursor\scripts\Test-RovisHealth.ps1" 2>&1
        $tail = $healthOut | Select-Object -Last 4
        $tail | ForEach-Object { Write-Host "  $_" }
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "================================================="
Write-Host " ROVIS INSTALADO em: $Project"
Write-Host " Proximo passo: abrir Cursor no projeto e digitar 'modo ROVIS'"
Write-Host "================================================="
