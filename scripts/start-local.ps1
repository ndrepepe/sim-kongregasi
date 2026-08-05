$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$processFile = Join-Path $projectRoot '.local-processes.json'
$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$pgReady = Join-Path $projectRoot '.local\postgresql\bin\pg_isready.exe'
$pgCtl = Join-Path $projectRoot '.local\postgresql\bin\pg_ctl.exe'
$pgData = Join-Path $projectRoot '.local\pgdata'
if (Test-Path $pgReady) {
  & $pgReady -h localhost -p 5432 *> $null
  if ($LASTEXITCODE -ne 0) { & $pgCtl -D $pgData -l (Join-Path $projectRoot '.local\postgresql.log') start }
}
function Get-ListeningProcessId([int]$Port) {
  return (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
}

$tracked = if (Test-Path $processFile) { Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json } else { $null }
$apiListenerPid = Get-ListeningProcessId 4000
$webListenerPid = Get-ListeningProcessId 3000
$apiPid = if ($apiListenerPid -and $tracked -and $tracked.api -and (Get-Process -Id $tracked.api -ErrorAction SilentlyContinue)) { [int]$tracked.api } else { $apiListenerPid }
$webPid = if ($webListenerPid -and $tracked -and $tracked.web -and (Get-Process -Id $tracked.web -ErrorAction SilentlyContinue)) { [int]$tracked.web } else { $webListenerPid }
$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
if (-not $apiPid) {
  $api = Start-Process -FilePath $pnpm -ArgumentList '--filter','@sim-kongregasi/api','dev' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'api.log') -RedirectStandardError (Join-Path $logDir 'api-error.log')
  $apiPid = $api.Id
}
if (-not $webPid) {
  $web = Start-Process -FilePath $pnpm -ArgumentList '--filter','@sim-kongregasi/web','dev' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'web.log') -RedirectStandardError (Join-Path $logDir 'web-error.log')
  $webPid = $web.Id
}
@{ api = $apiPid; web = $webPid } | ConvertTo-Json | Set-Content -LiteralPath $processFile -Encoding UTF8

$deadline = (Get-Date).AddMinutes(3)
$nextProgress = (Get-Date).AddSeconds(10)
do {
  $apiPortReady = [bool](Get-ListeningProcessId 4000)
  $webPortReady = [bool](Get-ListeningProcessId 3000)
  if ($apiPortReady -and $webPortReady) {
    try {
      $health = Invoke-RestMethod -Uri 'http://localhost:4000/api/health-check' -TimeoutSec 5
      $webResponse = Invoke-WebRequest -Uri 'http://localhost:3000/dashboard/anggota' -UseBasicParsing -TimeoutSec 5
      if ($health.status -eq 'ok' -and $health.database -eq 'connected' -and $webResponse.StatusCode -eq 200) {
        Write-Host 'SIM Kongregasi siap digunakan: http://localhost:3000/dashboard/anggota'
        exit 0
      }
    } catch {
      # Proses sudah membuka port tetapi masih menyelesaikan inisialisasi.
    }
  }
  if ((Get-Date) -ge $nextProgress) {
    Write-Host 'SIM Kongregasi masih memulai, mohon tunggu...'
    $nextProgress = (Get-Date).AddSeconds(10)
  }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

throw "SIM Kongregasi belum siap setelah 3 menit. Periksa $logDir\api-error.log dan $logDir\web-error.log."
