param(
  [Parameter(Mandatory = $false)]
  [string]$AgentsPath = ".cursor/agents"
)

$ErrorActionPreference = "Stop"

$requiredFiles = @(
  "00-product-manager.md",
  "01-orchestrator.md",
  "02-architect.md",
  "03-backend.md",
  "04-frontend.md",
  "05-qa.md",
  "06-devops.md",
  "07-reviewer.md",
  "08-rovis-fe.md",
  "09-rovis-be.md"
)

$requiredMarkers = @(
  "Protocolo Unificado (v2)",
  "Scorecard"
)

$missingFiles = @()
$missingMarkers = @()

foreach ($file in $requiredFiles) {
  $path = Join-Path $AgentsPath $file
  if (-not (Test-Path $path)) {
    $missingFiles += $file
    continue
  }

  $text = Get-Content $path -Raw -Encoding utf8
  foreach ($marker in $requiredMarkers) {
    if ($text -notmatch [regex]::Escape($marker)) {
      $missingMarkers += "$file :: $marker"
    }
  }
}

if ($missingFiles.Count -gt 0 -or $missingMarkers.Count -gt 0) {
  Write-Output "AGENT_SCORECARD_FAIL"
  if ($missingFiles.Count -gt 0) {
    Write-Output ("missing_files=" + ($missingFiles -join ","))
  }
  if ($missingMarkers.Count -gt 0) {
    Write-Output ("missing_markers=" + ($missingMarkers -join " | "))
  }
  exit 1
}

Write-Output "AGENT_SCORECARD_OK"
exit 0
