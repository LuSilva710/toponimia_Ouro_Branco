param(
    [string]$Root = ".cursor"
)

$ErrorActionPreference = "Stop"

$contractPath = Join-Path $Root "governance/qa-targets-contract.json"
if (-not (Test-Path $contractPath)) {
    throw "QA targets contract not found: $contractPath"
}

$contract = Get-Content $contractPath -Raw | ConvertFrom-Json
$runtimeTargetsResolverPath = Join-Path $Root "scripts/Resolve-RovisRuntimeTargets.ps1"
$runtimeTargets = $null
if (Test-Path $runtimeTargetsResolverPath) {
    $runtimeTargets = powershell -ExecutionPolicy Bypass -File $runtimeTargetsResolverPath -Root $Root | ConvertFrom-Json
}

$environmentConfig = Get-Content $contract.environmentConfigPath -Raw | ConvertFrom-Json
$qualityGates = Get-Content $contract.qualityGatesPath -Raw | ConvertFrom-Json

$activeEnvironment = $environmentConfig.activeEnvironment
$activeConfig = $environmentConfig.environments.$activeEnvironment
if (-not $activeConfig) {
    throw "Active QA environment not found: $activeEnvironment"
}

$targetsPath = if ((Test-Path $contract.preferredTargetsPath) -and $contract.rules.preferRealTargets) {
    $contract.preferredTargetsPath
} elseif (Test-Path $contract.fallbackTargetsPath) {
    $contract.fallbackTargetsPath
} else {
    throw "No QA targets file found"
}

$targets = Get-Content $targetsPath -Raw | ConvertFrom-Json
$resolvedFrontendUrl = if ($runtimeTargets -and $runtimeTargets.frontendUrl) { $runtimeTargets.frontendUrl } else { $activeConfig.frontendUrl }
$resolvedBackendUrl = if ($runtimeTargets -and $runtimeTargets.backendUrl) { $runtimeTargets.backendUrl } else { $activeConfig.backendUrl }
$existingPipelineContext = if ($targets.pipelineContext) { $targets.pipelineContext } else { [pscustomobject]@{} }
$targets | Add-Member -Force -NotePropertyName pipelineContext -NotePropertyValue ([pscustomobject]@{
    buildId = if ($existingPipelineContext.buildId) { $existingPipelineContext.buildId } else { "resolved" }
    commitSha = if ($existingPipelineContext.commitSha) { $existingPipelineContext.commitSha } else { "dev" }
    environment = $activeEnvironment
    frontendUrl = $resolvedFrontendUrl
    backendUrl = $resolvedBackendUrl
    swaggerUiUrl = if ($runtimeTargets) { $runtimeTargets.swaggerUiUrl } else { "" }
    swaggerJsonUrl = if ($runtimeTargets) { $runtimeTargets.swaggerJsonUrl } else { "" }
})

$contractsPath = if ($targets.generation.contractsPath) { $targets.generation.contractsPath } else { $contract.defaultContractsPath }
$features = New-Object System.Collections.Generic.List[object]

foreach ($method in @($targets.targets.backendMethods)) {
    if ($null -eq $method) { continue }
    $features.Add([pscustomobject]@{
        title = "Backend target: $($method.name)"
        description = "Executar o target backend '$($method.name)' no ambiente $activeEnvironment usando $resolvedBackendUrl."
        acceptanceCriteria = @(
            "O comando configurado deve executar sem erro fatal.",
            "A saida deve conter '$($method.expectedContains)'.",
            "O target deve refletir um fluxo verificavel do repositorio."
        )
    })
}

foreach ($flow in @($targets.targets.frontendFlows)) {
    if ($null -eq $flow) { continue }
    $route = if ($flow.route) { [string]$flow.route } else { "/" }
    $features.Add([pscustomobject]@{
        title = "Frontend flow: $($flow.name)"
        description = "Validar o fluxo '$($flow.name)' na rota '$route' usando $resolvedFrontendUrl."
        acceptanceCriteria = @(
            "A rota alvo deve estar acessivel.",
            "O comando configurado deve produzir a evidencia esperada '$($flow.expectedContains)'.",
            "O fluxo deve ser executavel contra o ambiente configurado."
        )
    })
}

foreach ($validation in @($targets.targets.fieldValidations)) {
    if ($null -eq $validation) { continue }
    $features.Add([pscustomobject]@{
        title = "Field validation: $($validation.field)"
        description = "Validar a regra '$($validation.rule)' para o campo '$($validation.field)'."
        acceptanceCriteria = @(
            "O valor valido deve ser aceito.",
            "O valor invalido deve ser rejeitado.",
            "A validacao deve refletir o ambiente configurado."
        )
    })
}

foreach ($mask in @($targets.targets.maskValidations)) {
    if ($null -eq $mask) { continue }
    $features.Add([pscustomobject]@{
        title = "Mask validation: $($mask.field)"
        description = "Validar a mascara '$($mask.maskPattern)' para o campo '$($mask.field)'."
        acceptanceCriteria = @(
            "Amostras validas devem passar.",
            "Amostras invalidas devem falhar.",
            "A regra deve seguir o padrao configurado."
        )
    })
}

$resolved = [pscustomobject]@{
    resolvedAt = (Get-Date).ToString("o")
    activeEnvironment = $activeEnvironment
    frontendUrl = $resolvedFrontendUrl
    backendUrl = $resolvedBackendUrl
    swaggerUiUrl = if ($runtimeTargets) { $runtimeTargets.swaggerUiUrl } else { "" }
    swaggerJsonUrl = if ($runtimeTargets) { $runtimeTargets.swaggerJsonUrl } else { "" }
    sourceTargetsPath = $targetsPath
    contractsPath = $contractsPath
    qualityGates = $qualityGates
    targets = $targets.targets
}

$resolvedDir = Split-Path -Path $contract.resolvedTargetsPath -Parent
if (-not [string]::IsNullOrWhiteSpace($resolvedDir)) {
    New-Item -ItemType Directory -Force -Path $resolvedDir | Out-Null
}

$resolved | ConvertTo-Json -Depth 12 | Set-Content -Path $contract.resolvedTargetsPath -Encoding utf8
$features | ConvertTo-Json -Depth 8 | Set-Content -Path $contract.resolvedFeaturesPath -Encoding utf8

[pscustomobject]@{
    resolvedTargetsPath = $contract.resolvedTargetsPath
    resolvedFeaturesPath = $contract.resolvedFeaturesPath
    frontendUrl = $resolvedFrontendUrl
    backendUrl = $resolvedBackendUrl
    swaggerUiUrl = if ($runtimeTargets) { $runtimeTargets.swaggerUiUrl } else { "" }
    swaggerJsonUrl = if ($runtimeTargets) { $runtimeTargets.swaggerJsonUrl } else { "" }
    sourceTargetsPath = $targetsPath
    contractsPath = $contractsPath
} | ConvertTo-Json -Depth 6
