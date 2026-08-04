# SIM Kongregasi

Sistem Informasi Manajemen Kongregasi berbasis web untuk data anggota, struktur organisasi, penugasan, kesehatan, keuangan, dokumen, kronik, peringatan, audit, serta panduan dan pelaporan klaim asuransi bertahap.

## Menjalankan di Windows

Prasyarat: Node.js 24+ dan pnpm 10+. PostgreSQL 18.4 dipasang secara privat di folder `.local` sehingga tidak memerlukan hak Administrator Windows.

```powershell
.\scripts\install-postgresql-local.ps1
.\scripts\setup-local.ps1
.\scripts\start-local.ps1
```

- Aplikasi: <http://localhost:3000>
- API: <http://localhost:4000/api>
- Dokumentasi API: <http://localhost:4000/docs>

Akun awal: `admin@simkongregasi.local`. Kata sandi awal ditentukan saat menjalankan `setup-local.ps1` (default lokal tersedia di parameter skrip) dan wajib diganti pada login pertama. Rahasia runtime tersimpan hanya di `.env`, tidak masuk Git.

Hentikan aplikasi dengan `scripts\stop-local.ps1`. Buat backup terkompresi dengan `scripts\backup-db.ps1`.

## Pemeriksaan kualitas

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Dokumen acuan utama tersedia di `output/documents/Panduan_Lengkap_Pembangunan_SIM_Kongregasi_v2.0.docx` dan `output/pdf/Panduan_Lengkap_Pembangunan_SIM_Kongregasi_v2.0.pdf`.

Dokumentasi teknis: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, dan `docs/LOCAL_OPERATIONS.md`.
