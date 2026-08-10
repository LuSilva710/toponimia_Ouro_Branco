# Get-RovisProjectProfile.ps1
# Detecta stack, endpoints, paginas e scripts do projeto.
# Saida: project-profile.json + atualiza bloco [PROJECT PROFILE] em memory/00-context.md.

[CmdletBinding()]
param(
    [string]$Root         = ".",
    [string]$OutputJson   = ".cursor/memory/cold/project-profile.json",
    [string]$ContextPath  = ".cursor/memory/00-context.md",
    [switch]$NoContextWrite
)

$ErrorActionPreference = "Stop"
$start = Get-Date

function Test-PathRel { param([string]$p) Test-Path (Join-Path $Root $p) }
function Read-File    { param([string]$p) $full = Join-Path $Root $p; if (Test-Path -LiteralPath $full) { Get-Content -LiteralPath $full -Raw -ErrorAction SilentlyContinue } else { "" } }

$detected = [ordered]@{
    backend  = @()
    frontend = @()
    db       = @()
    infra    = @()
}

# Backend / linguagem principal
if (Get-ChildItem -Path $Root -Filter "*.csproj" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) { $detected.backend += ".NET (csproj)" }
if (Get-ChildItem -Path $Root -Filter "*.sln"    -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) { $detected.backend += ".NET solution" }
if (Test-PathRel "go.mod")                                       { $detected.backend += "Go" }
if (Test-PathRel "Cargo.toml")                                   { $detected.backend += "Rust" }
if (Test-PathRel "requirements.txt" -or (Test-PathRel "pyproject.toml")) { $detected.backend += "Python" }
if (Test-PathRel "pom.xml" -or (Test-PathRel "build.gradle"))    { $detected.backend += "Java" }

# Frontend / Node
$packageJson = $null
if (Test-PathRel "package.json") {
    try { $packageJson = (Read-File "package.json") | ConvertFrom-Json } catch {}
}
if ($packageJson) {
    $deps = @{}
    if ($packageJson.dependencies)    { $packageJson.dependencies.PSObject.Properties    | ForEach-Object { $deps[$_.Name] = $_.Value } }
    if ($packageJson.devDependencies) { $packageJson.devDependencies.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $_.Value } }

    if ($deps.ContainsKey("next"))         { $detected.frontend += "Next.js" }
    if ($deps.ContainsKey("react"))        { $detected.frontend += "React" }
    if ($deps.ContainsKey("vue"))          { $detected.frontend += "Vue" }
    if ($deps.ContainsKey("svelte"))       { $detected.frontend += "Svelte" }
    if ($deps.ContainsKey("vite"))         { $detected.frontend += "Vite" }
    if ($deps.ContainsKey("typescript"))   { $detected.frontend += "TypeScript" }
    if ($deps.ContainsKey("tailwindcss"))  { $detected.frontend += "Tailwind" }
    if ($deps.ContainsKey("@mui/material") -or $deps.ContainsKey("@mui/core")) { $detected.frontend += "MUI" }
    if ($deps.ContainsKey("primereact"))   { $detected.frontend += "PrimeReact" }
    if ($deps.ContainsKey("@tauri-apps/api")) { $detected.frontend += "Tauri" }
    if ($deps.ContainsKey("express"))      { $detected.backend  += "Express" }
    if ($deps.ContainsKey("fastify"))      { $detected.backend  += "Fastify" }
    if ($deps.ContainsKey("nestjs") -or $deps.ContainsKey("@nestjs/core")) { $detected.backend += "NestJS" }
    if ($deps.ContainsKey("prisma"))       { $detected.db       += "Prisma" }
    if ($deps.ContainsKey("typeorm"))      { $detected.db       += "TypeORM" }
    if ($deps.ContainsKey("knex"))         { $detected.db       += "Knex" }
    if ($deps.ContainsKey("mongoose"))     { $detected.db       += "MongoDB (mongoose)" }
}

# DB / infra (heuristicas em arquivos)
$allFiles = Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|build|\.next|coverage" } |
    Select-Object -First 5000

$blob = ""
foreach ($f in $allFiles | Where-Object { $_.Length -lt 100KB -and $_.Extension -in ".cs",".ts",".tsx",".js",".jsx",".json",".yml",".yaml",".env",".csproj",".config" }) {
    try { $blob += (Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue) + "`n" } catch {}
    if ($blob.Length -gt 500000) { break }
}
$lower = $blob.ToLower()

if ($lower.Contains("postgres") -or $lower.Contains("npgsql"))   { $detected.db += "PostgreSQL" }
if ($lower.Contains("mongodb")  -or $lower.Contains("mongo://")) { $detected.db += "MongoDB" }
if ($lower.Contains("redis"))                                    { $detected.db += "Redis" }
if ($lower.Contains("rabbitmq"))                                 { $detected.infra += "RabbitMQ" }
if ($lower.Contains("aws s3") -or $lower.Contains("amazons3"))   { $detected.infra += "AWS S3" }
if ($lower.Contains("azuredevops") -or $lower.Contains("azure-pipelines.yml")) { $detected.infra += "Azure DevOps" }
if ($lower.Contains("entityframework") -or $lower.Contains("ef core") -or $lower.Contains("dbcontext")) { $detected.db += "EF Core" }

foreach ($k in @("backend","frontend","db","infra")) {
    $detected[$k] = @($detected[$k] | Select-Object -Unique)
}

# Endpoints (heuristica multi-stack)
$endpoints = New-Object System.Collections.Generic.List[hashtable]
$endpointPatterns = @(
    @{ stack="dotnet"; regex='\[Http(Get|Post|Put|Delete|Patch)(\("([^"]+)"\))?\]' },
    @{ stack="express"; regex='\b(?:app|router)\.(get|post|put|delete|patch)\(\s*[''"`]([^''"`]+)' },
    @{ stack="nestjs";  regex='@(Get|Post|Put|Delete|Patch)\(\s*[''"`]?([^\)''"`]*)' },
    @{ stack="fastify"; regex='\bfastify\.(get|post|put|delete|patch)\(\s*[''"`]([^''"`]+)' }
)
foreach ($f in $allFiles | Where-Object { $_.Extension -in ".cs",".ts",".tsx",".js",".jsx" -and $_.Length -lt 200KB }) {
    $c = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $c) { continue }
    foreach ($p in $endpointPatterns) {
        $matches = [regex]::Matches($c, $p.regex)
        foreach ($m in $matches) {
            $method = if ($m.Groups.Count -ge 2) { $m.Groups[1].Value } else { "?" }
            $route  = if ($m.Groups.Count -ge 3) { $m.Groups[$m.Groups.Count - 1].Value } else { "" }
            if ($endpoints.Count -lt 200) {
                $endpoints.Add(@{
                    stack  = $p.stack
                    method = $method.ToUpper()
                    route  = $route
                    file   = (Resolve-Path -Relative $f.FullName)
                })
            }
        }
    }
}

# Paginas (Next/React)
$pages = New-Object System.Collections.Generic.List[string]
foreach ($folder in @("src/pages","pages","app","src/app","src/routes")) {
    $full = Join-Path $Root $folder
    if (Test-Path $full) {
        Get-ChildItem -Path $full -File -Recurse -Include "*.tsx","*.jsx","*.ts","*.js","page.tsx","page.jsx" -ErrorAction SilentlyContinue |
            Select-Object -First 100 |
            ForEach-Object { $pages.Add((Resolve-Path -Relative $_.FullName)) }
    }
}

# Scripts npm + comandos uteis
$scripts = @{}
if ($packageJson -and $packageJson.scripts) {
    $packageJson.scripts.PSObject.Properties | ForEach-Object { $scripts[$_.Name] = $_.Value }
}

# Profile final
$profile = [ordered]@{
    generatedAt   = (Get-Date).ToString("o")
    rootPath      = (Resolve-Path $Root).Path
    durationMs    = [int]((Get-Date) - $start).TotalMilliseconds
    detected      = $detected
    counts        = @{
        endpoints = $endpoints.Count
        pages     = $pages.Count
        scripts   = $scripts.Count
        scanned   = $allFiles.Count
    }
    endpoints     = @($endpoints | Select-Object -First 50)
    pages         = @($pages | Select-Object -First 50)
    npmScripts    = $scripts
}

$dir = Split-Path $OutputJson -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$profile | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputJson -Encoding UTF8

Write-Host "[PROFILE] backend=$($detected.backend -join ',')"
Write-Host "[PROFILE] frontend=$($detected.frontend -join ',')"
Write-Host "[PROFILE] db=$($detected.db -join ',') | infra=$($detected.infra -join ',')"
Write-Host "[PROFILE] endpoints=$($endpoints.Count) pages=$($pages.Count) scripts=$($scripts.Count)"
Write-Host "[PROFILE] JSON: $OutputJson"

if ($NoContextWrite) { exit 0 }
if (-not (Test-Path $ContextPath)) {
    Write-Host "[PROFILE] context ausente: $ContextPath - pulando bloco"
    exit 0
}

$markerStart = "<!-- PROJECT_PROFILE_START -->"
$markerEnd   = "<!-- PROJECT_PROFILE_END -->"
$block = @"
$markerStart
## [PROJECT PROFILE] (auto)
Atualizado: $((Get-Date).ToString("yyyy-MM-dd HH:mm"))

- Backend:  $(if ($detected.backend.Count -gt 0)  { $detected.backend -join ', '  } else { '(nao detectado)' })
- Frontend: $(if ($detected.frontend.Count -gt 0) { $detected.frontend -join ', ' } else { '(nao detectado)' })
- DB:       $(if ($detected.db.Count -gt 0)       { $detected.db -join ', '       } else { '(nao detectado)' })
- Infra:    $(if ($detected.infra.Count -gt 0)    { $detected.infra -join ', '    } else { '(nao detectado)' })

Endpoints detectados: $($endpoints.Count) | Paginas: $($pages.Count) | Scripts npm: $($scripts.Count)
Detalhes: ``.cursor/memory/cold/project-profile.json``
$markerEnd
"@

$current = Get-Content -LiteralPath $ContextPath -Raw -Encoding UTF8
if ($current -match [regex]::Escape($markerStart)) {
    $pattern = "(?s)" + [regex]::Escape($markerStart) + ".*?" + [regex]::Escape($markerEnd)
    $current = [regex]::Replace($current, $pattern, $block)
} else {
    $current = $current.TrimEnd() + "`n`n" + $block + "`n"
}
Set-Content -Path $ContextPath -Value $current -Encoding UTF8 -NoNewline

Write-Host "[PROFILE] Bloco [PROJECT PROFILE] atualizado em $ContextPath"
