# Arsitektur SIM Kongregasi

## Susunan

- `apps/web`: Next.js App Router, React, TypeScript, antarmuka responsif/PWA.
- `apps/api`: NestJS modular monolith, REST API, validasi DTO, Swagger.
- PostgreSQL 18.4: sumber data transaksional tunggal.
- `uploads`: penyimpanan berkas lokal; metadata dan checksum ada di database.

Antarmuka tidak mengakses database secara langsung. Semua akses melewati API, autentikasi, pembatasan peran, dan lingkup organisasi. Model modular monolith dipilih agar mudah dioperasikan secara lokal tetapi dapat dipisah menjadi layanan terpisah bila skala organisasi membutuhkannya.

## Domain data

Skema awal mencakup organisasi, pengguna, anggota, penugasan, formasi, kesehatan, obat, asuransi, laporan tahap klaim, dokumen, akun keuangan, jurnal berpasangan, kronik, memorial, workflow, notifikasi, refresh token, dan audit log.

Data organisasi menggunakan UUID dan relasi induk-anak. Tabel operasional memiliki `organization_id` untuk pembatasan lingkup. Penghapusan logis diterapkan pada data master dan dokumen yang membutuhkan retensi.

## Klaim asuransi

Panduan klaim adalah PDF berversi dan terpisah dari transaksi klaim. Klaim bergerak melalui state machine:

`DRAFT → REPORTED → DOCUMENTS_PENDING/SUBMITTED → VERIFICATION → APPROVED/REJECTED → PAID → CLOSED`

Setiap transisi menulis `insurance_claim_events` dengan catatan laporan wajib, pelapor, waktu, dan referensi eksternal opsional. Lompatan tahap ditolak oleh API.
