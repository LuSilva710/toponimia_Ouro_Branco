# Build-RovisCodeIndex.ps1
# Indexa o codigo do projeto (hash + tags) para busca rapida (RAG-lite).
# Saida: .cursor/memory/cold/code-index.json

[CmdletBinding()]
param(
    [string]$Root        = ".",
    [string]$OutputPath  = ".cursor/memory/cold/code-index.json",
    [string[]]$Include   = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.cs", "*.py", "*.go", "*.rs", "*.java", "*.sql", "*.json"),
    [string[]]$Exclude   = @("node_modules", ".git", "dist", "build", ".next", "coverage", ".cursor/testing-module/tmp", ".cursor/memory/cold")
)

$ErrorActionPreference = "Stop"

function Get-Tags {
    param([string]$Path, [string]$Content)
    $tags = New-Object System.Collections.Generic.HashSet[string]

    foreach ($part in ($Path -split "[/\\]")) {
        if ($part.Length -gt 2 -and $part -notmatch "^\.") { [void]$tags.Add($part.ToLower()) }
    }

    $lower = $Content.ToLower()
    $keywords = @{
        "auth"       = @("login", "logout", "token", "jwt", "session", "auth")
        "api"        = @("router", "controller", "endpoint", "fastify", "express", "@get", "@post", "@put", "@delete")
        "db"         = @("select ", "insert ", "update ", "delete ", "create table", "migration", "knex", "prisma", "typeorm")
        "form"       = @("validation", "yup", "zod", "useform", "register(")
        "ui"         = @("usestate", "useeffect", "render(", "<div", "tailwind", "styled.")
        "test"       = @("describe(", "it(", "expect(", "test(", "playwright")
        "contract"   = @("openapi", "swagger", "schema", "interface ", "type ")
    }

    foreach ($k in $keywords.Keys) {
        foreach ($needle in $keywords[$k]) {
            if ($lower.Contains($needle)) { [void]$tags.Add($k); break }
        }
    }
    return @($tags)
}

$indexed = New-Object System.Collections.Generic.List[hashtable]
$start = Get-Date
$skipped = 0

$allFiles = Get-ChildItem -Path $Root -File -Recurse -Include $Include -ErrorAction SilentlyContinue
foreach ($file in $allFiles) {
    $rel = (Resolve-Path -Relative -LiteralPath $file.FullName)
    $skip = $false
    foreach ($ex in $Exclude) {
        if ($rel -like "*$ex*") { $skip = $true; break }
    }
    if ($skip) { $skipped++; continue }
    if ($file.Length -gt 200KB) { $skipped++; continue }

    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
    } catch { $skipped++; continue }

    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    $tags = Get-Tags -Path $rel -Content $content
    $first = ($content -split "`n" | Select-Object -First 3) -join " | "

    $indexed.Add(@{
        path        = $rel
        sha256      = $hash
        sizeBytes   = $file.Length
        lineCount   = ($content -split "`n").Count
        tags        = $tags
        head        = $first.Substring(0, [Math]::Min(200, $first.Length))
        modifiedAt  = $file.LastWriteTime.ToString("o")
    })
}

$result = [ordered]@{
    generatedAt   = (Get-Date).ToString("o")
    durationMs    = [int]((Get-Date) - $start).TotalMilliseconds
    rootPath      = (Resolve-Path $Root).Path
    totalIndexed  = $indexed.Count
    skipped       = $skipped
    files         = $indexed
}

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$result | ConvertTo-Json -Depth 6 -Compress | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "[CODE-INDEX] Indexados: $($indexed.Count) | Pulados: $skipped | Tempo: $([math]::Round(((Get-Date) - $start).TotalSeconds, 1))s"
Write-Host "[CODE-INDEX] Output: $OutputPath"
