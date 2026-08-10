param(
    [string]$Path = ".cursor/memory"
)

$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$legacy = [System.Text.Encoding]::GetEncoding(1252)

Get-ChildItem -Path $Path -Filter *.md | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $needsConversion = $false

    try {
        [void]$utf8Strict.GetString($bytes)
    }
    catch {
        $needsConversion = $true
    }

    if ($needsConversion) {
        $text = $legacy.GetString($bytes)
        [System.IO.File]::WriteAllText($_.FullName, $text, [System.Text.UTF8Encoding]::new($false))
        Write-Output "Converted to UTF-8: $($_.Name)"
    }
    else {
        Write-Output "Already UTF-8: $($_.Name)"
    }
}
