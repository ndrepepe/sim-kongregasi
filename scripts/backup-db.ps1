[CmdletBinding()]
param([string]$DatabasePassword = 'simkongregasi_local_2026')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pgDumpCommand = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
if ($pgDumpCommand) {
  $pgDumpPath = $pgDumpCommand.Source
} else {
  $localDump = Join-Path $projectRoot '.local\postgresql\bin\pg_dump.exe'
  if (Test-Path $localDump) { $pgDumpPath = $localDump } else { $pgDumpPath = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' }
}
$backupDir = Join-Path $projectRoot 'backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$target = Join-Path $backupDir ("sim_kongregasi_{0}.dump" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
$env:PGPASSWORD = $DatabasePassword
try { & $pgDumpPath -h localhost -p 5432 -U simkongregasi_app -d sim_kongregasi -Fc -f $target } finally { Remove-Item Env:PGPASSWORD }
Write-Host "Backup berhasil: $target"
