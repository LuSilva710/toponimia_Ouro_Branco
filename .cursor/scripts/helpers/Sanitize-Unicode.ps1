# Sanitize-Unicode.ps1
# Substitui caracteres unicode "perigosos" por equivalentes ASCII em arquivos de script.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string[]]$Files
)

$ErrorActionPreference = "Stop"

$dash    = [char]0x2014  # em-dash
$nDash   = [char]0x2013  # en-dash
$lQuote  = [char]0x201C
$rQuote  = [char]0x201D
$lApos   = [char]0x2018
$rApos   = [char]0x2019
$ellips  = [char]0x2026

foreach ($f in $Files) {
    if (-not (Test-Path $f)) { Write-Host "skip (missing): $f"; continue }
    $c = Get-Content $f -Raw -Encoding UTF8
    $orig = $c
    $c = $c.Replace([string]$dash, '-').Replace([string]$nDash, '-').Replace([string]$lQuote, '"').Replace([string]$rQuote, '"').Replace([string]$lApos, "'").Replace([string]$rApos, "'").Replace([string]$ellips, '...')
    if ($c -ne $orig) {
        Set-Content -Path $f -Value $c -Encoding UTF8 -NoNewline
        Write-Host "sanitized: $f"
    } else {
        Write-Host "clean: $f"
    }
}
