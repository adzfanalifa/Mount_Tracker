# Mount Tracker Backend (PHP 8 + MySQL)

Panduan lengkap ada di [README utama](../README.md): instalasi Laragon, import database, `.env`, akses dari HP, daftar endpoint, dan checklist.

## Ringkas

Jalankan perintah ini satu per satu dari folder `mount-tracker-backend`:

```bash
copy .env.example .env
```

Isi `.env` dulu, minimal `JWT_SECRET` dan `DB_*`. Lalu:

```bash
composer install
```

```bash
mysql -u root < database/schema.sql
```

```bash
mysql -u root mount_tracker < database/seed.sql
```

```bash
php -S 0.0.0.0:8000 -t public public/index.php
```

Tes semua endpoint (butuh `APP_DEBUG=true` dan Mailpit yang sedang berjalan):

```bash
php tests/api_test.php http://127.0.0.1:8000
```

## Catatan

- Nama field JSON memakai **camelCase**.
- Semua response berformat `{success, message, data}`.
- Endpoint lama (`/emergencies`, `/forgot` + `/reset`, `/trips/{id}/locations`, dan lainnya) tetap tersedia.
