param(
    [string]$Root = ".cursor",
    [switch]$SkipProbe
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param(
        [string]$CursorRoot,
        [string]$Path
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    if (Test-Path $Path) {
        return (Resolve-Path $Path).Path
    }

    $repoRoot = (Resolve-Path (Join-Path $CursorRoot "..")).Path
    return (Join-Path $repoRoot $Path)
}

function Get-FilesByName {
    param(
        [string]$BasePath,
        [string[]]$Names,
        [string[]]$ExcludedRootNames
    )

    return @(Get-ChildItem -Path $BasePath -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $current = $_
        $nameMatch = $Names -contains $current.Name
        if (-not $nameMatch) { return $false }

        foreach ($excluded in $ExcludedRootNames) {
            if ($current.FullName -match [regex]::Escape("\$excluded\")) {
                return $false
            }
        }

        return $true
    })
}

function Get-UrlsFromLaunchSettings {
    param([string]$Path)

    $urls = New-Object System.Collections.Generic.List[string]
    try {
        $launch = Get-Content $Path -Raw | ConvertFrom-Json
        if ($launch.iisSettings.iisExpress.applicationUrl) {
            foreach ($url in ($launch.iisSettings.iisExpress.applicationUrl -split ";")) {
                if (-not [string]::IsNullOrWhiteSpace($url)) {
                    $urls.Add($url.Trim())
                }
            }
        }

        foreach ($profile in @($launch.profiles.PSObject.Properties)) {
            $applicationUrl = $profile.Value.applicationUrl
            if ([string]::IsNullOrWhiteSpace($applicationUrl)) { continue }
            foreach ($url in ($applicationUrl -split ";")) {
                if (-not [string]::IsNullOrWhiteSpace($url)) {
                    $urls.Add($url.Trim())
                }
            }
        }
    }
    catch {
    }

    return @($urls | Select-Object -Unique)
}

function Get-FirstRegexValue {
    param(
        [string]$Text,
        [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($Text -match $pattern) {
            return $Matches[1]
        }
    }

    return ""
}

function Join-Url {
    param(
        [string]$BaseUrl,
        [string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        return ""
    }

    return ($BaseUrl.TrimEnd("/") + "/" + $RelativePath.TrimStart("/"))
}

function Test-HttpTarget {
    param(
        [string]$Url,
        [int]$TimeoutSeconds
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds -UseBasicParsing
        return [pscustomobject]@{
            reachable = $true
            statusCode = [int]$response.StatusCode
            contentType = [string]$response.Headers["Content-Type"]
            body = [string]$response.Content
        }
    }
    catch {
        $statusCode = 0
        $body = ""
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        try {
            if ($_.ErrorDetails.Message) {
                $body = [string]$_.ErrorDetails.Message
            }
        }
        catch {
        }

        return [pscustomobject]@{
            reachable = $false
            statusCode = $statusCode
            contentType = ""
            body = $body
        }
    }
}

$contractPath = Join-Path $Root "governance/runtime-targets-contract.json"
if (-not (Test-Path $contractPath)) {
    throw "Runtime targets contract not found: $contractPath"
}

$contract = Get-Content $contractPath -Raw | ConvertFrom-Json
$repoRoot = (Resolve-Path (Join-Path $Root $contract.workspaceRootRelativeToCursor)).Path
$environmentConfigPath = Resolve-RepoPath -CursorRoot $Root -Path $contract.environmentConfigPath
$resolvedTargetsPath = Resolve-RepoPath -CursorRoot $Root -Path $contract.resolvedTargetsPath
$environmentConfig = Get-Content $environmentConfigPath -Raw | ConvertFrom-Json
$activeEnvironment = $environmentConfig.activeEnvironment
$activeConfig = $environmentConfig.environments.$activeEnvironment

$launchSettingsFiles = Get-FilesByName -BasePath $repoRoot -Names @($contract.backend.launchSettingsFileName) -ExcludedRootNames @($contract.excludedRootNames)
$programFiles = Get-FilesByName -BasePath $repoRoot -Names @($contract.backend.programFileNames) -ExcludedRootNames @($contract.excludedRootNames)
$packageFiles = Get-FilesByName -BasePath $repoRoot -Names @($contract.frontend.packageFileName) -ExcludedRootNames @($contract.excludedRootNames)
$viteConfigFiles = Get-FilesByName -BasePath $repoRoot -Names @($contract.frontend.viteConfigFileNames) -ExcludedRootNames @($contract.excludedRootNames)

$backendCandidates = New-Object System.Collections.Generic.List[string]
foreach ($file in $launchSettingsFiles) {
    foreach ($url in @(Get-UrlsFromLaunchSettings -Path $file.FullName)) {
        if (-not [string]::IsNullOrWhiteSpace($url)) {
            $backendCandidates.Add($url)
        }
    }
}

foreach ($envVarName in @($contract.backend.envVarNames)) {
    $value = [System.Environment]::GetEnvironmentVariable($envVarName, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [System.Environment]::GetEnvironmentVariable($envVarName, "User")
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [System.Environment]::GetEnvironmentVariable($envVarName, "Machine")
    }
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        foreach ($url in ($value -split ";")) {
            if (-not [string]::IsNullOrWhiteSpace($url)) {
                $backendCandidates.Add($url.Trim())
            }
        }
    }
}

$backendUrl = @($backendCandidates | Select-Object -Unique | Select-Object -First 1)[0]
$backendSource = if ($backendUrl) { "workspace" } else { "environment-fallback" }
if ([string]::IsNullOrWhiteSpace($backendUrl)) {
    $backendUrl = $activeConfig.backendUrl
}

$frontendUrl = ""
$frontendSource = ""
$frontendCandidates = New-Object System.Collections.Generic.List[object]

foreach ($packageFile in $packageFiles) {
    try {
        $package = Get-Content $packageFile.FullName -Raw | ConvertFrom-Json
        $packageText = Get-Content $packageFile.FullName -Raw
        $tool = ""
        $defaultPort = 0

        if ($packageText -match '"vite"') {
            $tool = "vite"
            $defaultPort = [int]$contract.frontend.defaultPortsByTool.vite
        }
        elseif ($packageText -match '"next"') {
            $tool = "next"
            $defaultPort = [int]$contract.frontend.defaultPortsByTool.next
        }
        elseif ($packageText -match '"react-scripts"') {
            $tool = "react-scripts"
            $defaultPort = [int]$contract.frontend.defaultPortsByTool."react-scripts"
        }
        elseif ($packageText -match '"@angular/core"') {
            $tool = "angular"
            $defaultPort = [int]$contract.frontend.defaultPortsByTool.angular
        }

        if ([string]::IsNullOrWhiteSpace($tool)) { continue }

        $packageDir = Split-Path $packageFile.FullName -Parent
        $matchingViteConfig = $viteConfigFiles | Where-Object { (Split-Path $_.FullName -Parent) -eq $packageDir } | Select-Object -First 1
        $configuredPort = 0
        if ($matchingViteConfig) {
            $viteText = Get-Content $matchingViteConfig.FullName -Raw
            $portMatch = Get-FirstRegexValue -Text $viteText -Patterns @(
                'port\s*:\s*(\d+)',
                'PORT\s*=\s*(\d+)'
            )
            if ($portMatch) {
                $configuredPort = [int]$portMatch
            }
        }

        $candidatePort = if ($configuredPort -gt 0) { $configuredPort } else { $defaultPort }
        if ($candidatePort -gt 0) {
            $frontendCandidates.Add([pscustomobject]@{
                url = "http://localhost:$candidatePort"
                tool = $tool
                sourcePath = $packageFile.FullName
            })
        }
    }
    catch {
    }
}

if ($frontendCandidates.Count -gt 0) {
    $frontendUrl = $frontendCandidates[0].url
    $frontendSource = "workspace"
}
else {
    $frontendUrl = $activeConfig.frontendUrl
    $frontendSource = "environment-fallback"
}

$swaggerEnabledByCode = $false
foreach ($programFile in $programFiles) {
    $programText = Get-Content $programFile.FullName -Raw
    foreach ($marker in @($contract.backend.swaggerMarkers)) {
        if ($programText -match [regex]::Escape($marker)) {
            $swaggerEnabledByCode = $true
            break
        }
    }
    if ($swaggerEnabledByCode) { break }
}

$swaggerJsonUrl = ""
$swaggerUiUrl = ""
$swaggerTitle = ""
$swaggerVersion = ""
$swaggerPathCount = 0
$swaggerSource = if ($swaggerEnabledByCode) { "workspace-inferred" } else { "not-detected" }

foreach ($candidatePath in @($contract.swagger.candidatePaths)) {
    $candidateUrl = Join-Url -BaseUrl $backendUrl -RelativePath $candidatePath
    if ([string]::IsNullOrWhiteSpace($candidateUrl)) { continue }

    if ($SkipProbe) {
        if ($candidatePath -like "*.json" -and [string]::IsNullOrWhiteSpace($swaggerJsonUrl)) {
            $swaggerJsonUrl = $candidateUrl
        }
        elseif ([string]::IsNullOrWhiteSpace($swaggerUiUrl)) {
            $swaggerUiUrl = $candidateUrl
        }
        continue
    }

    $probe = Test-HttpTarget -Url $candidateUrl -TimeoutSeconds ([int]$contract.swagger.requestTimeoutSeconds)
    if ($candidatePath -like "*.json") {
        if ($probe.statusCode -eq 200) {
            $swaggerJsonUrl = $candidateUrl
            $swaggerSource = "http-probe"
            try {
                $swaggerDoc = $probe.body | ConvertFrom-Json
                $swaggerTitle = [string]$swaggerDoc.info.title
                $swaggerVersion = [string]$swaggerDoc.info.version
                if ($swaggerDoc.paths) {
                    $swaggerPathCount = @($swaggerDoc.paths.PSObject.Properties).Count
                }
            }
            catch {
            }
            break
        }
    }
    elseif ($probe.statusCode -eq 200 -and [string]::IsNullOrWhiteSpace($swaggerUiUrl)) {
        $swaggerUiUrl = $candidateUrl
        if ($swaggerSource -eq "not-detected") {
            $swaggerSource = "http-probe"
        }
    }
}

if ([string]::IsNullOrWhiteSpace($swaggerUiUrl) -and -not [string]::IsNullOrWhiteSpace($backendUrl) -and $swaggerEnabledByCode) {
    $swaggerUiUrl = (Join-Url -BaseUrl $backendUrl -RelativePath "/swagger")
}
if ([string]::IsNullOrWhiteSpace($swaggerJsonUrl) -and -not [string]::IsNullOrWhiteSpace($backendUrl) -and $swaggerEnabledByCode) {
    $swaggerJsonUrl = (Join-Url -BaseUrl $backendUrl -RelativePath "/swagger/v1/swagger.json")
}

$confidence = if ($backendSource -eq "workspace" -or $frontendSource -eq "workspace" -or $swaggerSource -eq "http-probe") {
    "high"
}
elseif ($swaggerSource -eq "workspace-inferred") {
    "medium"
}
else {
    "fallback"
}

$result = [pscustomobject]@{
    resolvedAt = (Get-Date).ToString("o")
    workspaceRoot = $repoRoot
    activeEnvironment = $activeEnvironment
    backendUrl = $backendUrl
    frontendUrl = $frontendUrl
    swaggerUiUrl = $swaggerUiUrl
    swaggerJsonUrl = $swaggerJsonUrl
    swaggerDetected = (-not [string]::IsNullOrWhiteSpace($swaggerUiUrl) -or -not [string]::IsNullOrWhiteSpace($swaggerJsonUrl))
    swaggerDocument = [pscustomobject]@{
        title = $swaggerTitle
        version = $swaggerVersion
        pathCount = $swaggerPathCount
    }
    sourceOfTruth = [pscustomobject]@{
        backend = $backendSource
        frontend = $frontendSource
        swagger = $swaggerSource
    }
    confidence = $confidence
    evidence = [pscustomobject]@{
        launchSettingsFiles = @($launchSettingsFiles | ForEach-Object { $_.FullName })
        programFiles = @($programFiles | ForEach-Object { $_.FullName })
        packageFiles = @($packageFiles | ForEach-Object { $_.FullName })
        viteConfigFiles = @($viteConfigFiles | ForEach-Object { $_.FullName })
    }
}

$resolvedDir = Split-Path -Path $resolvedTargetsPath -Parent
if (-not [string]::IsNullOrWhiteSpace($resolvedDir)) {
    New-Item -ItemType Directory -Force -Path $resolvedDir | Out-Null
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Path $resolvedTargetsPath -Encoding utf8
$result | ConvertTo-Json -Depth 8
