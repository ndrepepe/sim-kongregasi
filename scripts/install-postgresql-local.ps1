[CmdletBinding()]
param([string]$SuperuserPassword = 'simkongregasi_local_2026')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $projectRoot '.local'
$cache = Join-Path $projectRoot '.cache'
$archive = Join-Path $cache 'postgresql-18.4-windows-x64-binaries.zip'
$packageDir = Join-Path $localRoot 'postgresql-package'
$postgresDir = Join-Path $localRoot 'postgresql'
$dataDir = Join-Path $localRoot 'pgdata'
$downloadUrl = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260303'
New-Item -ItemType Directory -Path $cache,$localRoot -Force | Out-Null
if (-not (Test-Path $archive)) {
  Write-Host 'Mengunduh PostgreSQL 18.4 untuk Windows dari EDB...'
  Invoke-WebRequest -Uri $downloadUrl -OutFile $archive -UseBasicParsing
}
if (-not (Test-Path (Join-Path $postgresDir 'bin\postgres.exe'))) {
  if (Test-Path $packageDir) { Remove-Item -LiteralPath $packageDir -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $packageDir -Force
  $extracted = Get-ChildItem -LiteralPath $packageDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'bin\postgres.exe') } | Select-Object -First 1
  if (-not $extracted) { throw 'Arsip PostgreSQL tidak memiliki struktur biner yang diharapkan.' }
  Move-Item -LiteralPath $extracted.FullName -Destination $postgresDir
}
$initdb = Join-Path $postgresDir 'bin\initdb.exe'
$pgCtl = Join-Path $postgresDir 'bin\pg_ctl.exe'
$pgReady = Join-Path $postgresDir 'bin\pg_isready.exe'
if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  $passwordFile = Join-Path $localRoot 'pg-password.tmp'
  try {
    Set-Content -LiteralPath $passwordFile -Value $SuperuserPassword -Encoding ascii -NoNewline
    & $initdb -D $dataDir -U postgres -A scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C
  } finally { Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue }
  Add-Content -LiteralPath (Join-Path $dataDir 'postgresql.conf') -Value "`nlisten_addresses = 'localhost'`nport = 5432`n"
}
& $pgReady -h localhost -p 5432 | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDir -l (Join-Path $localRoot 'postgresql.log') start
  $ready = $false
  1..20 | ForEach-Object {
    if (-not $ready) { Start-Sleep -Milliseconds 500; & $pgReady -h localhost -p 5432 *> $null; if ($LASTEXITCODE -eq 0) { $ready = $true } }
  }
  if (-not $ready) { throw 'PostgreSQL lokal tidak siap dalam 10 detik. Periksa .local\postgresql.log.' }
}
Write-Host "PostgreSQL lokal aktif di localhost:5432. Biner: $postgresDir"
