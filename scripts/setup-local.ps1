[CmdletBinding()]
param(
  [string]$PostgresPassword = 'simkongregasi_local_2026',
  [string]$AppDatabasePassword = 'simkongregasi_local_2026',
  [string]$AdminEmail = 'admin@simkongregasi.local',
  [string]$AdminPassword = 'SimKongregasi!2026'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$psqlCommand = Get-Command psql.exe -ErrorAction SilentlyContinue
if ($psqlCommand) {
  $psqlPath = $psqlCommand.Source
} else {
  $candidates = @((Join-Path $projectRoot '.local\postgresql\bin\psql.exe'),'C:\Program Files\PostgreSQL\18\bin\psql.exe')
  $candidate = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($candidate) { $psqlPath = $candidate } else { throw 'PostgreSQL 18 belum terpasang. Jalankan install-postgresql-local.ps1.' }
}

$env:PGPASSWORD = $PostgresPassword
$roleExists = & $psqlPath -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='simkongregasi_app'"
if (-not $roleExists) {
  & $psqlPath -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE simkongregasi_app LOGIN PASSWORD '$AppDatabasePassword'"
} else {
  & $psqlPath -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE simkongregasi_app WITH LOGIN PASSWORD '$AppDatabasePassword'"
}
$dbExists = & $psqlPath -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sim_kongregasi'"
if (-not $dbExists) {
  & $psqlPath -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE sim_kongregasi OWNER simkongregasi_app ENCODING ''UTF8'''
}
Remove-Item Env:PGPASSWORD

$secretBytes = New-Object byte[] 48
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($secretBytes) } finally { $generator.Dispose() }
$jwtSecret = [Convert]::ToBase64String($secretBytes)
$apiEnv = @"
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://simkongregasi_app:$AppDatabasePassword@localhost:5432/sim_kongregasi
JWT_SECRET=$jwtSecret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=7
SEED_ADMIN_EMAIL=$AdminEmail
SEED_ADMIN_PASSWORD=$AdminPassword
"@
Set-Content -LiteralPath (Join-Path $projectRoot 'apps\api\.env') -Value $apiEnv -Encoding UTF8
Set-Content -LiteralPath (Join-Path $projectRoot 'apps\web\.env.local') -Value 'NEXT_PUBLIC_API_URL=http://localhost:4000/api' -Encoding UTF8

Push-Location $projectRoot
try {
  pnpm install --frozen-lockfile=false
  if ($LASTEXITCODE -ne 0) { throw 'Instalasi dependensi gagal.' }
  pnpm db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi database gagal.' }
  pnpm db:seed
  if ($LASTEXITCODE -ne 0) { throw 'Seed database gagal.' }
} finally { Pop-Location }
Write-Host "Instalasi lokal selesai. Masuk dengan $AdminEmail dan kata sandi awal yang diberikan pada setup."
