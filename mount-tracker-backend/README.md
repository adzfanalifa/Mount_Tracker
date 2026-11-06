# Mount Tracker Backend (PHP + MySQL)

Backend untuk aplikasi mobile Mount Tracker (Expo / React Native, folder `mobile/`).
Nama field JSON memakai camelCase supaya sama dengan class di `mobile/src/models.js`.

## Setup
1. Import `schema.sql` ke MySQL (sudah berisi 4 gunung + jalur dari `data.js`).
2. Edit `config.php`: database dan **`jwt_secret` wajib diganti**.
3. Jalankan lokal (PHP 7.4+, disarankan 8+):
   `php -S 0.0.0.0:8000 index.php`
   Di hosting Apache, taruh folder ini apa adanya (`.htaccess` sudah ada).
4. Admin (untuk tambah/ubah gunung & jalur): daftar lewat `/register`, lalu di MySQL:
   `UPDATE users SET role='admin' WHERE username='namamu';`

Dari HP, URL-nya BUKAN `localhost`, pakai IP laptop di WiFi yang sama, contoh `http://192.168.1.5:8000`.

## Endpoint
Header untuk yang butuh login: `Authorization: Bearer <token>`

| Method | Path | Keterangan |
|---|---|---|
| POST | /register | username, email, password, confirmPassword |
| POST | /login | login (email atau username), password |
| POST | /forgot | username, email -> resetToken |
| POST | /reset | resetToken, newPassword |
| GET | /me | data user |
| GET | /mountains?q=&difficulty= | list gunung + trails (nama) + trailDetails |
| GET | /mountains/{id} | detail gunung |
| POST/PUT/DELETE | /mountains, /mountains/{id} | admin |
| POST | /mountains/{id}/trails | admin |
| PUT/DELETE | /trails/{id} | admin |
| GET/POST | /contacts | kontak darurat (name, phone, relationship, isPrimary) |
| PUT | /contacts/{id}/primary | jadikan kontak utama |
| DELETE | /contacts/{id} | hapus kontak |
| GET | /trips?status= | riwayat pendakian |
| POST | /trips | mountainId, trailName, groupSize, plannedDays, startDate, expectedReturnAt?, contactId?, notes? |
| GET | /trips/{id} | detail + semua lokasi |
| POST | /trips/{id}/start, /finish, /cancel | ubah status |
| POST | /trips/{id}/locations | latitude, longitude, altitudeM, accuracyM, source, recordedAt (atau `{"locations":[...]}`) |
| GET/POST | /emergencies | type, message, location, tripId? |
| POST | /emergencies/{id}/resolve | status: resolved / cancelled |
| GET/POST | /issues | category, description |

## Aturan yang sama dengan frontend
- Kontak pertama otomatis jadi utama; hapus kontak utama -> kontak berikutnya jadi utama.
- Telepon 8-15 angka (boleh diawali +). Jumlah orang minimal 1, lama 1-14 hari.
- Tanggal berangkat tidak boleh di masa lalu; default estimasi turun = hari terakhir jam 18:00.
- Hanya 1 pendakian aktif per user. Lokasi hanya bisa dicatat saat pendakian aktif.
- SOS tanpa GPS memakai lokasi terakhir yang diketahui dari pendakian aktif.

## Catatan keamanan
- `/forgot` saat ini mengembalikan token langsung di response (belum kirim email), karena layar
  Forgot di aplikasi hanya minta username + email. Sebelum rilis beneran, ganti ke kirim lewat email.
- Pakai HTTPS di server asli, dan ganti `allowed_origin` kalau ada versi web.
