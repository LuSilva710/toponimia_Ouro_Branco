param(
  [Parameter(Mandatory = $false)]
  [string]$TargetsPath = ".cursor/testing-module/config/testing-targets.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git/hooks")) {
  throw "Pasta .git/hooks não encontrada. Execute na raiz do repositório."
}

$blockingHook = @"
#!/usr/bin/env bash
powershell -ExecutionPolicy Bypass -File .cursor/testing-module/scripts/Run-TestModule.ps1 -TargetsPath $TargetsPath
exit $?
"@

$postHook = @"
#!/usr/bin/env bash
powershell -ExecutionPolicy Bypass -File .cursor/testing-module/scripts/Run-TestModule.ps1 -TargetsPath $TargetsPath
"@

Set-Content -Path ".git/hooks/pre-commit" -Value $blockingHook -Encoding utf8
Set-Content -Path ".git/hooks/pre-push" -Value $blockingHook -Encoding utf8
Set-Content -Path ".git/hooks/post-commit" -Value $postHook -Encoding utf8
Set-Content -Path ".git/hooks/post-merge" -Value $postHook -Encoding utf8
Set-Content -Path ".git/hooks/post-checkout" -Value $postHook -Encoding utf8

Write-Output "Hooks instalados: pre-commit, pre-push, post-commit, post-merge, post-checkout"
