param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("backlog", "planning", "implementation", "testing", "done", "checkpoint")]
    [string]$Log,

    [Parameter(Mandatory = $true)]
    [string]$Title,

    [Parameter(Mandatory = $true)]
    [string]$Body,

    [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Agent = "ROVIS",
    [string]$Root = ".cursor"
)

$map = @{
    backlog = (Join-Path $Root "memory/03-backlog.md")
    planning = (Join-Path $Root "memory/04-planning-log.md")
    implementation = (Join-Path $Root "memory/06-implementation-log.md")
    testing = (Join-Path $Root "memory/07-testing-log.md")
    done = (Join-Path $Root "memory/09-done.md")
    checkpoint = (Join-Path $Root "memory/10-checkpoint.md")
}

$path = if ([System.IO.Path]::IsPathRooted($map[$Log])) {
    $map[$Log]
}
else {
    Join-Path (Get-Location) $map[$Log]
}
if (-not (Test-Path $path)) {
    throw "Arquivo de memoria nao encontrado: $path"
}

$entry = @"

## $Date - $Title
Data: $Date
Agente: $Agent
$Body
"@

Add-Content -Path $path -Value $entry -Encoding utf8
Write-Output "Memory updated: $path"
