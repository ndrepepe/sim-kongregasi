$projectRoot = Split-Path -Parent $PSScriptRoot
$processFile = Join-Path $projectRoot '.local-processes.json'
if (Test-Path $processFile) {
  $ids = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
  @($ids.api,$ids.web) | ForEach-Object { Stop-Process -Id $_ -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $processFile -Force
}
Get-NetTCPConnection -LocalPort 3000,4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
Write-Host 'Proses lokal SIM Kongregasi dihentikan.'
