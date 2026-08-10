param(
  [Parameter(Mandatory = $false)]
  [string]$RepoRoot = ".",

  [Parameter(Mandatory = $false)]
  [string]$TargetsPath = ".cursor/testing-module/config/testing-targets.sample.json"
)

$ErrorActionPreference = "Stop"

$fullRoot = (Resolve-Path $RepoRoot).Path
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $fullRoot
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, Size, DirectoryName'

$extensions = @('.cs', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml', '.ps1')
$ignoredPathParts = @('\\.git\\', '\\.cursor\\testing-module\\reports\\', '\\bin\\', '\\obj\\', '\\node_modules\\')
$script:running = $false
$script:lastRun = Get-Date "2000-01-01"

function Should-Run {
  param([string]$path)

  if ([string]::IsNullOrWhiteSpace($path)) { return $false }
  $full = [System.IO.Path]::GetFullPath($path)
  foreach ($part in $ignoredPathParts) {
    if ($full -match [regex]::Escape($part.Trim('\\'))) { return $false }
  }

  $ext = [System.IO.Path]::GetExtension($full)
  return $extensions -contains $ext
}

function Invoke-TestModule {
  param([string]$changedPath)

  if ($script:running) { return }

  $now = Get-Date
  if (($now - $script:lastRun).TotalSeconds -lt 2) { return }

  $script:running = $true
  $script:lastRun = $now

  Write-Output "[testing-module] alteração detectada: $changedPath"
  Write-Output "[testing-module] executando módulo automático..."

  try {
    & powershell -ExecutionPolicy Bypass -File ".cursor/testing-module/scripts/Run-TestModule.ps1" -TargetsPath $TargetsPath
  }
  catch {
    Write-Output "[testing-module] erro ao executar: $($_.Exception.Message)"
  }
  finally {
    $script:running = $false
  }
}

$action = {
  $path = $Event.SourceEventArgs.FullPath
  if (Should-Run -path $path) {
    Invoke-TestModule -changedPath $path
  }
}

Register-ObjectEvent $watcher Changed -Action $action | Out-Null
Register-ObjectEvent $watcher Created -Action $action | Out-Null
Register-ObjectEvent $watcher Renamed -Action $action | Out-Null

Write-Output "[testing-module] watcher ativo em: $fullRoot"
Write-Output "[testing-module] alvo: $TargetsPath"
Write-Output "[testing-module] pressione Ctrl+C para parar"

while ($true) {
  Start-Sleep -Seconds 1
}
