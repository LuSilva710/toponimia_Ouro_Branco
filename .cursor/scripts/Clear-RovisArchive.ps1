# Clear-RovisArchive.ps1
# Limpa snapshots antigos de .cursor/memory/archive/.
# Por padrao apaga apenas snapshots com mais de N dias. Use -All para apagar tudo.

[CmdletBinding()]
param(
    [string]$ArchivePath = ".cursor/memory/archive",
    [int]$OlderThanDays  = 30,
    [switch]$All,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ArchivePath)) {
    Write-Host "[CLEAR-ARCHIVE] Sem archive em: $ArchivePath"
    exit 0
}

$dirs = Get-ChildItem -Path $ArchivePath -Directory -ErrorAction SilentlyContinue
$totalDirs = $dirs.Count

if ($totalDirs -eq 0) {
    Write-Host "[CLEAR-ARCHIVE] Archive vazio"
    exit 0
}

Write-Host ""
Write-Host "================================================="
Write-Host " ROVIS CLEAR ARCHIVE"
Write-Host "================================================="
Write-Host " Path:      $ArchivePath"
Write-Host " Total:     $totalDirs snapshot(s)"
if ($All) {
    Write-Host " Modo:      ALL (apaga tudo)"
} else {
    Write-Host " Modo:      OlderThanDays=$OlderThanDays"
}
Write-Host " DryRun:    $DryRun"
Write-Host "-------------------------------------------------"

$cutoff = (Get-Date).AddDays(-$OlderThanDays)
$toDelete = if ($All) { $dirs } else { $dirs | Where-Object { $_.LastWriteTime -lt $cutoff } }

if ($toDelete.Count -eq 0) {
    Write-Host "[CLEAR-ARCHIVE] Nada para apagar (todos snapshots tem menos de $OlderThanDays dias)"
    exit 0
}

$totalSize = 0
foreach ($d in $toDelete) {
    $size = 0
    try {
        $size = (Get-ChildItem -Path $d.FullName -Recurse -File -ErrorAction SilentlyContinue |
                 Measure-Object -Property Length -Sum).Sum
    } catch {}
    $totalSize += $size
    $sizeKb = [math]::Round($size / 1KB, 1)
    Write-Host ("  - {0,-40} {1,8} KB  ({2})" -f $d.Name, $sizeKb, $d.LastWriteTime.ToString("yyyy-MM-dd"))
}

$totalKb = [math]::Round($totalSize / 1KB, 1)
Write-Host ("-" * 50)
Write-Host "[CLEAR-ARCHIVE] Apagar $($toDelete.Count) snapshot(s) - $totalKb KB no total"

if ($DryRun) {
    Write-Host "[CLEAR-ARCHIVE] DryRun - nada foi apagado"
    exit 0
}

$deleted = 0
$failed = 0
foreach ($d in $toDelete) {
    try {
        Remove-Item -Path $d.FullName -Recurse -Force -ErrorAction Stop
        $deleted++
    } catch {
        Write-Host "[CLEAR-ARCHIVE] FALHA $($d.Name): $_"
        $failed++
    }
}

Write-Host ""
Write-Host "================================================="
Write-Host " ROVIS CLEAR concluido"
Write-Host " Apagados:  $deleted"
Write-Host " Falhas:    $failed"
Write-Host " Mantidos:  $($totalDirs - $deleted)"
Write-Host "================================================="
