# Panduan Presentasi Role SI Kongregasi

## Persiapan

1. Buka `http://localhost:3000`.
2. Kata sandi seluruh akun `@demo.local` sama dengan nilai `SEED_ADMIN_PASSWORD` pada konfigurasi lokal.
3. Awali presentasi dengan `admin@simkongregasi.local`, lalu buka **Administrasi Pengguna**.

Halaman administrasi menampilkan status akun, role, scope organisasi, periode akses, kebutuhan MFA, akun yang terkunci, serta jadwal access review. Tab **Role & permission** menjelaskan fokus dan batas tiap role. Tab **Access review** menyimpan keputusan KEEP, MODIFY, atau REVOKE beserta reviewer dan review berikutnya.

## Akun demonstrasi

| Role | Akun | Scope demo | Hal yang ditunjukkan |
|---|---|---|---|
| Pimpinan | `pimpinan@demo.local` | Kongregasi dan seluruh unit turunannya | Dashboard pimpinan, persetujuan, laporan, review akses |
| Dewan | `dewan@demo.local` | Mandat kongregasi | Usulan, keputusan, laporan baca |
| Superior Lokal | `superior.jakarta@demo.local` | Komunitas Maria Bunda dan unit turunannya | Anggota dan penugasan lokal, laporan klaim lokal |
| Sekretaris | `sekretaris@demo.local` | Kongregasi dan seluruh unit turunannya | Verifikasi data, struktur, penugasan, dokumen |
| Bendahara | `bendahara@demo.local` | Yayasan Santa Maria | Keuangan entitas dan persetujuan terkait |
| Magistra | `magistra@demo.local` | Komunitas Santa Clara | Formasi dan penugasan formandi |
| Kesehatan | `kesehatan@demo.local` | Komunitas Hati Kudus dan klinik turunannya | Kesehatan, klaim, 2 anggota, dan 2 penugasan |
| Arsiparis | `arsiparis@demo.local` | Kongregasi dan unit turunannya | Dokumen, kronik, kalender, memorial |
| Safeguarding | `safeguarding@demo.local` | Kasus yang ditugaskan | Dashboard tugas terbatas tanpa menu data umum |
| Auditor | `auditor@demo.local` | Kongregasi, berakhir 31 Desember 2026 | Audit read-only, laporan, dan daftar akun |
| Admin TI | `admin.ti@demo.local` | Administrasi teknis | Lifecycle akun dan audit tanpa akses kesehatan/keuangan |
| Suster | `suster.felisitas@demo.local` | Komunitas Maria Bunda | Profil/direktori terbatas, kalender, penugasan sendiri/unit |

## Alur presentasi yang disarankan

1. **Super Admin** — perlihatkan 13 akun, 13 role aktif, status MFA, masa akses, pembuatan akun, reset kata sandi, dan access review.
2. **Admin TI** — perlihatkan bahwa akun operasional dapat dikelola, tetapi role pimpinan/dewan/safeguarding tidak dapat diubah dan menu kesehatan tidak tersedia.
3. **Petugas Kesehatan** — perlihatkan fokus kerja kesehatan, anggota dalam scope, kunjungan, serta panduan PDF dan laporan tahap klaim; menu keuangan tidak tersedia.
4. **Superior Lokal** — perlihatkan bahwa data hanya berasal dari komunitas Maria Bunda dan unit karya turunannya.
5. **Suster Anggota** — perlihatkan tampilan sederhana, direktori terbatas, dan ketiadaan menu sensitif.
6. Kembali ke **Super Admin**, buka tab **Access review**, lalu jelaskan bahwa keputusan review tercatat dan pencabutan akses langsung memutus sesi pengguna.

## Catatan keamanan demo

- Akun `@demo.local` dan kata sandi bersama hanya untuk presentasi lokal, bukan produksi.
- Kolom MFA saat ini mengelola kewajiban dan status pendaftaran untuk demonstrasi governance. Enrollment authenticator dan tantangan OTP perlu diaktifkan sebelum penggunaan produksi.
- Hak akses tetap diperiksa oleh API. Mengetik URL modul yang tidak diizinkan akan menghasilkan HTTP 403 meskipun menu disembunyikan.
