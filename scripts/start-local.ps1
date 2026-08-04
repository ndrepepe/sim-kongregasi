$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$pgReady = Join-Path $projectRoot '.local\postgresql\bin\pg_isready.exe'
$pgCtl = Join-Path $projectRoot '.local\postgresql\bin\pg_ctl.exe'
$pgData = Join-Path $projectRoot '.local\pgdata'
if (Test-Path $pgReady) {
  & $pgReady -h localhost -p 5432 *> $null
  if ($LASTEXITCODE -ne 0) { & $pgCtl -D $pgData -l (Join-Path $projectRoot '.local\postgresql.log') start }
}
if (Get-NetTCPConnection -LocalPort 3000,4000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host 'Aplikasi atau salah satu port sudah aktif. Jalankan stop-local.ps1 bila perlu.'
  exit 0
}
$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$api = Start-Process -FilePath $pnpm -ArgumentList '--filter','@sim-kongregasi/api','dev' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'api.log') -RedirectStandardError (Join-Path $logDir 'api-error.log')
$web = Start-Process -FilePath $pnpm -ArgumentList '--filter','@sim-kongregasi/web','dev' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'web.log') -RedirectStandardError (Join-Path $logDir 'web-error.log')
@{ api = $api.Id; web = $web.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot '.local-processes.json') -Encoding UTF8
Write-Host 'SIM Kongregasi sedang dimulai. Buka http://localhost:3000 setelah beberapa detik.'
