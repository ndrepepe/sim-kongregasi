# Keamanan

- Kata sandi di-hash dengan bcrypt cost 12.
- Lima kegagalan login mengunci akun selama 15 menit.
- Access token berumur 15 menit; refresh token acak disimpan sebagai hash dan dapat dicabut.
- Token dikirim melalui cookie `HttpOnly`, `SameSite=Strict`; cookie produksi memakai `Secure`.
- RBAC membatasi tindakan menurut peran dan query dibatasi oleh organisasi pengguna.
- Input divalidasi dengan whitelist dan field asing ditolak.
- Query database selalu memakai parameter bind.
- Helmet, CORS terbatas, checksum SHA-256, batas unggahan 10 MB, dan verifikasi signature PDF diterapkan.
- Perubahan non-GET ditulis ke audit log; password/token disensor dari payload audit.
- PostgreSQL portable hanya mendengarkan `localhost`.

Untuk produksi, gunakan TLS reverse proxy, secret manager, antivirus unggahan, object storage terenkripsi, MFA/SSO, backup off-site terenkripsi, pengujian pemulihan, serta audit keamanan berkala.
