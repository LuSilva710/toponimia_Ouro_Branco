# Test-RovisMigrationSafety.ps1
# Analisa migrations recentes e bloqueia comandos destrutivos sem aprovacao explicita.

[CmdletBinding()]
param(
    [string]$MigrationsPath = "src/db/migrations",
    [string]$OutputPath     = ".cursor/testing-module/reports/be/migration-safety.json",
    [string[]]$Extensions   = @("*.sql", "*.ts", "*.js")
)

$ErrorActionPreference = "Stop"

$reportDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }

if (-not (Test-Path $MigrationsPath)) {
    Write-Host "[MIGRATION-SAFETY] Path inexistente: $MigrationsPath - OK (nada a verificar)"
    @{ generatedAt=(Get-Date).ToString("o"); migrations=@(); blocked=$false; reason="path-missing" } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8 -Force
    exit 0
}

$dangerousPatterns = @(
    @{ name="DROP TABLE";     regex="(?i)\bdrop\s+table\b";     severity="critical" },
    @{ name="DROP COLUMN";    regex="(?i)\bdrop\s+column\b";    severity="critical" },
    @{ name="DROP DATABASE";  regex="(?i)\bdrop\s+database\b";  severity="critical" },
    @{ name="RENAME TABLE";   regex="(?i)\brename\s+table\b";   severity="serious"  },
    @{ name="RENAME COLUMN";  regex="(?i)\brename\s+column\b";  severity="serious"  },
    @{ name="ALTER TYPE";     regex="(?i)\balter\s+column[^;]+\btype\b"; severity="serious" },
    @{ name="NOT NULL no default"; regex="(?i)\bnot\s+null\b(?![^;]*\bdefault\b)"; severity="moderate" },
    @{ name="TRUNCATE";       regex="(?i)\btruncate\b";          severity="critical" }
)

$findings = New-Object System.Collections.Generic.List[hashtable]
$files = Get-ChildItem -Path $MigrationsPath -File -Recurse -Include $Extensions -ErrorAction SilentlyContinue

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    $hasApprovalComment = ($content -match "(?i)#\s*rovis-approved-destructive")
    foreach ($p in $dangerousPatterns) {
        $matches = [regex]::Matches($content, $p.regex)
        if ($matches.Count -gt 0) {
            $findings.Add(@{
                file       = (Resolve-Path -Relative $f.FullName)
                pattern    = $p.name
                severity   = $p.severity
                count      = $matches.Count
                approved   = $hasApprovalComment
            })
        }
    }
}

$blocked = ($findings | Where-Object { $_.severity -in @("critical","serious") -and -not $_.approved }).Count -gt 0

$report = [ordered]@{
    generatedAt   = (Get-Date).ToString("o")
    migrationsPath = $MigrationsPath
    filesScanned  = $files.Count
    findings      = $findings
    blocked       = $blocked
    rule          = "Para liberar: adicionar comentario '# rovis-approved-destructive' na migration apos aprovado humano"
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[MIGRATION-SAFETY] files=$($files.Count) findings=$($findings.Count) blocked=$blocked"
Write-Host "[MIGRATION-SAFETY] Relatorio: $OutputPath"
if ($blocked) { exit 2 }
