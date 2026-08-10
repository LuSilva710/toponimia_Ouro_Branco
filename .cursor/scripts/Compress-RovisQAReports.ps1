# Compress-RovisQAReports.ps1
# Mantem os N relatorios mais recentes em tmp/ e arquiva o resto em archive/<YYYY-MM>/.

[CmdletBinding()]
param(
    [int]$KeepLast = 10,
    [string]$TmpPath = ".cursor/testing-module/tmp",
    [string]$ArchiveRoot = ".cursor/testing-module/reports/archive"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TmpPath)) {
    Write-Host "[QA-COMPRESS] tmp inexistente: $TmpPath"
    exit 0
}

$files = Get-ChildItem -Path $TmpPath -File -Filter "ai-final-report-*.json" |
    Sort-Object LastWriteTime -Descending

$total = $files.Count
Write-Host "[QA-COMPRESS] Encontrados $total relatorios em $TmpPath"

if ($total -le $KeepLast) {
    Write-Host "[QA-COMPRESS] Nada para arquivar (limite: $KeepLast)"
    exit 0
}

$toArchive = $files | Select-Object -Skip $KeepLast
$archived = 0
$failed = 0

foreach ($file in $toArchive) {
    try {
        $month = $file.LastWriteTime.ToString("yyyy-MM")
        $destDir = Join-Path $ArchiveRoot $month
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        $dest = Join-Path $destDir $file.Name
        Move-Item -Path $file.FullName -Destination $dest -Force
        $archived++
    }
    catch {
        Write-Host "[QA-COMPRESS] FALHA arquivar $($file.Name): $_"
        $failed++
    }
}

Write-Host "[QA-COMPRESS] Mantidos: $KeepLast | Arquivados: $archived | Falhas: $failed"
Write-Host "[QA-COMPRESS] Archive root: $ArchiveRoot"
