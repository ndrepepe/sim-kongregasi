# Operasi Lokal Windows

## Instalasi pertama

Jalankan PowerShell dari root proyek:

```powershell
.\scripts\install-postgresql-local.ps1
.\scripts\setup-local.ps1
.\scripts\start-local.ps1
```

`install-postgresql-local.ps1` mengunduh arsip biner PostgreSQL 18.4 resmi EDB, mengekstraknya ke `.local/postgresql`, membuat klaster `.local/pgdata`, dan membatasi koneksi ke localhost. `setup-local.ps1` membuat role aplikasi, database, `.env`, migrasi, serta data awal.

## Operasi harian

```powershell
.\scripts\start-local.ps1
.\scripts\stop-local.ps1
.\scripts\backup-db.ps1
```

Log aplikasi berada di `logs`; log PostgreSQL di `.local/postgresql.log`. Folder ini tidak masuk Git.

## Verifikasi

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
Invoke-RestMethod http://localhost:4000/api/health-check
```

## Pemulihan backup

Hentikan aplikasi, buat database kosong yang pemiliknya `simkongregasi_app`, lalu gunakan `pg_restore` dari `.local/postgresql/bin`. Uji pemulihan secara berkala pada database terpisah sebelum backup dianggap valid.
