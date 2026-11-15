# Mount Tracker

Aplikasi untuk mencatat pendakian gunung:

- rencana pendakian
- pelacakan GPS dan check-in di setiap pos, lengkap dengan estimasi jam sampai
- pemantauan kesehatan
- cuaca per jam
- SOS dan kontak darurat
- riwayat pendakian
- mode terang dan gelap

| Folder | Isi |
|---|---|
| `mount-tracker-backend/` | REST API PHP 8 + MySQL, dijalankan di Laragon (Windows) |
| `mobile/` | Aplikasi HP **Expo (React Native)**, SDK 58 |
| `TESTING.md` | Tes otomatis dan langkah tes manual di HP |

---

## 1. Kebutuhan

- **Laragon**: sudah termasuk PHP 8.3, MySQL 8.4, HeidiSQL, Composer, Git, dan Mailpit.
- **Node.js 20 atau lebih baru**: Laragon juga menyertakan Node 22.
- HP Android atau iOS dengan aplikasi **Expo Go** dari Play Store / App Store.
- Laptop dan HP tersambung ke **WiFi yang sama**.

## 2. Backend

### 2.1 Install Laragon dan jalankan MySQL

1. Install Laragon dari https://laragon.org, lalu buka aplikasinya.
2. Klik **Start All**. Pastikan MySQL berwarna hijau.
3. Klik kanan Laragon → **Terminal**. Semua perintah di bawah diketik di terminal ini (PHP dan Composer sudah ada di PATH-nya).

### 2.2 Import database

> ⚠️ `schema.sql` akan **menghapus lalu membuat ulang** database `mount_tracker`.
> Kalau ada data lama yang ingin disimpan, export dulu lewat HeidiSQL: klik kanan database → *Export database as SQL*.

**Cara 1: HeidiSQL**

1. Buka HeidiSQL dari Laragon (tombol **Database**).
2. Pilih **File → Run SQL file…** → `mount-tracker-backend/database/schema.sql`.
3. Ulangi untuk `seed.sql`.

**Cara 2: terminal Laragon**

```bash
cd mount-tracker-backend
```

```bash
mysql -u root < database/schema.sql
```

```bash
mysql -u root mount_tracker < database/seed.sql
```

Isi `seed.sql`:

- **4 gunung**:

  | Gunung | Tingkat |
  |---|---|
  | Carstensz | extreme |
  | Gede | easy |
  | Pangrango | medium |
  | Rinjani | easy |

- **Jalur Rinjani via Sembalun** dengan 6 pos:

  | Pos | Ketinggian | Jarak |
  |---|---|---|
  | Pos 1 Sembalun | 1156 mdpl | 1,2 km |
  | Pos 2 | 1800 mdpl | 3,4 km |
  | Pos 3 | 2100 mdpl | 5,1 km |
  | Pos 4 | 2400 mdpl | 6,8 km |
  | Plawangan | 2639 mdpl | 9,6 km* |
  | Puncak | 3726 mdpl | 13,5 km* |

  Koordinat semua pos adalah **perkiraan** dan ditandai `is_sample = 1`. Jarak bertanda * juga perkiraan.

- **Akun demo** (lihat bagian 5).

### 2.3 Isi `.env`

```bash
copy .env.example .env
```

```bash
php -r "echo bin2hex(random_bytes(32));"
```

Buka `.env`, lalu isi:

- `JWT_SECRET`: tempel hasil perintah kedua di atas (wajib, minimal 32 karakter).
- `DB_NAME=mount_tracker`, `DB_USER=root`, `DB_PASS=` (kosong, bawaan Laragon).
- `APP_DEBUG=false` untuk dipakai sungguhan. Isi `true` hanya saat menjalankan tes otomatis.
- **Email reset password lewat Gmail:**
  1. Aktifkan *Verifikasi 2 Langkah* di akun Google.
  2. Buka https://myaccount.google.com/apppasswords dan buat App Password.
  3. Isi di `.env`:
     ```
     MAIL_HOST=smtp.gmail.com
     MAIL_PORT=587
     MAIL_ENCRYPTION=tls
     MAIL_USERNAME=alamat-gmail-kamu@gmail.com
     MAIL_PASSWORD=app-password-16-huruf
     ```
  Kalau `MAIL_USERNAME` dikosongkan, email dikirim ke **Mailpit** Laragon. Isinya bisa dilihat di http://localhost:8025. Mailpit dijalankan dari menu Laragon → *Mail* (atau jalankan `mailpit.exe`).
- **Login Google** (opsional): isi `GOOGLE_CLIENT_IDS` dengan Client ID dari bagian 3.3, dipisah koma.

### 2.4 Install library dan jalankan server

```bash
composer install
```

Kalau muncul error *zip extension missing*, aktifkan ekstensi `zip` lewat Laragon → PHP → Extensions, atau jalankan:

```bash
php -d extension=zip %LARAGON_ROOT%\bin\composer\composer.phar install
```

Lalu jalankan server:

```bash
php -S 0.0.0.0:8000 -t public public/index.php
```

Buka http://localhost:8000. Harus muncul `{"success":true,"message":"Server berjalan","data":{..."database":"ok"}}`.

> Cara lain (belum dites): taruh folder backend di `C:\laragon\www\`, lalu akses `http://IP-LAPTOP/mount-tracker-backend/`. File `.htaccess` sudah meneruskan semua request ke `public/`.

### 2.5 Supaya HP bisa mengakses backend (IP lokal, bukan localhost)

`localhost` di HP berarti **HP itu sendiri**, bukan laptop. Karena itu:

1. **Cari IP laptop.** Buka CMD, ketik `ipconfig`, lalu lihat **IPv4 Address** di adaptor *Wi-Fi*. Contoh: `192.168.1.5`.
2. Server harus dijalankan dengan `0.0.0.0` (seperti perintah di atas), bukan `127.0.0.1`.
3. **Firewall.** Saat pertama menjalankan `php`, Windows biasanya bertanya; pilih **Allow** untuk *Private network*. Kalau terlanjur ditolak, jalankan perintah ini di CMD **sebagai Administrator**:
   ```bash
   netsh advfirewall firewall add rule name="Mount Tracker API" dir=in action=allow protocol=TCP localport=8000
   ```
4. **Tes dari browser HP:** buka `http://192.168.1.5:8000/`. Kalau JSON-nya muncul, berarti sudah tersambung.
5. Jika WiFi kampus/kantor memblokir koneksi antar perangkat (*client isolation*), pakai hotspot HP atau **ngrok** (sudah ada di Laragon):
   ```bash
   ngrok http 8000
   ```
   Lalu pakai URL `https://….ngrok-free.app` yang muncul.

## 3. Frontend (aplikasi HP)

### 3.1 Install dan jalankan

```bash
cd mobile
```

```bash
npm install
```

```bash
copy .env.example .env
```

Buka `mobile/.env`, lalu isi `EXPO_PUBLIC_API_URL=http://192.168.1.5:8000` (ganti dengan IP laptopmu).

```bash
npx expo start -c
```

Scan QR code yang muncul dengan **Expo Go** (Android) atau aplikasi Kamera (iOS).

**Ganti alamat server tanpa restart:** di layar Sign In, ketuk tulisan **Server: …** di bagian bawah, isi alamat baru, lalu tekan **Simpan & Tes Koneksi**. Alamat ini tersimpan di HP.

### 3.2 Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm test` | Unit test (75 tes) |
| `npm run check:bundle` | Compile seluruh aplikasi Android untuk mengecek error |
| `npx expo start --web` | Versi browser untuk tes cepat. Peta diganti ringkasan karena react-native-maps tidak mendukung web |

### 3.3 Login Google (opsional)

1. Buka https://console.cloud.google.com/apis/credentials, lalu buat project.
2. Isi *OAuth consent screen*.
3. Buat **OAuth Client ID**:
   - Tipe **Web application**: untuk Expo Go dan web.
   - Tipe **Android**: package `com.mounttracker.app`, plus SHA-1 dari keystore build kamu.
   - Tipe **iOS** (kalau perlu): bundle id `com.mounttracker.app`.
4. Isi Client ID tersebut:
   - di `mobile/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `..._ANDROID_...`, `..._IOS_...`
   - di `.env` backend: `GOOGLE_CLIENT_IDS` (semua Client ID, dipisah koma)
5. Restart backend dan `npx expo start -c`.

Login Google paling stabil dites lewat *development build*:

```bash
npx expo run:android
```

Di Expo Go, redirect Google kadang ditolak. Selama Client ID belum diisi, tombol **Masuk dengan Google** hanya menampilkan pesan "belum dikonfigurasi".

## 4. Fitur dan aturan

### Maps

- **Belum memilih gunung:** hanya peta dan posisi HP, plus teks "Pilih gunung di tab Mount untuk melihat jalur". Tidak ada daftar atau marker pos.
- **Sudah memilih:** pilihan bisa dari tombol **Tambahkan Pendakian** di tab Mount, atau dari pendakian aktif/rencana di backend. Peta zoom ke gunung, menampilkan marker dan garis jalur, ditambah jejak GPS kalau pendakian aktif. Di bawahnya ada daftar pos dengan ikon status: ✔ sudah, 📍 sedang, ➜ belum. Setiap pos menampilkan jam sampai atau estimasi.
- Gunung terpilih disimpan di state global dan di HP, jadi sinkron antar tab.

### Check-in pos

Saat pendakian aktif, ketuk pos untuk mencatat jam sampai. Backend lalu menghitung estimasi untuk pos-pos berikutnya:

1. Hitung waktu tempuh dengan rumus **Naismith**: 4 km/jam, ditambah 1 jam untuk setiap 600 m tanjakan.
2. Kalikan dengan **kecepatan nyata rombongan**: perbandingan waktu tempuh sebenarnya dengan waktu Naismith (dibatasi 0,5×–3×).

### Tema

- Default mengikuti pengaturan HP.
- Bisa diganti manual lewat ikon ☀/☾ di pojok kanan atas, atau Profil → Tampilan (Ikuti sistem / Terang / Gelap).
- Pilihan disimpan di AsyncStorage.

### Kesehatan otomatis

Berjalan selama pendakian aktif, dikirim setiap 5 menit:

| Data | Sumber |
|---|---|
| Langkah | Pedometer HP (asli) |
| Ketinggian | GPS, atau pos terakhir yang di-check-in |
| Detak jantung, SpO2, suhu | **Simulasi**, mengikuti ketinggian dan kecepatan |
| Kalori | Dihitung dari langkah dan tanjakan |

Backend memberi peringatan kalau SpO2 < 90% dan peringatan bahaya kalau SpO2 < 85%.

### Lainnya

- **Starterpack** dihitung di aplikasi. Nilainya otomatis terisi dari jumlah orang dan lama hari di rencana pendakian.
- **Cuaca per jam** diambil backend dari Open-Meteo (tanpa API key) dan di-cache 15 menit.

## 5. Akun demo

| Username | Email | Password | Peran |
|---|---|---|---|
| `demo` | demo@mounttracker.local | `demo1234` | user (sudah punya 1 kontak darurat) |
| `admin` | admin@mounttracker.local | `admin1234` | admin (menu Pengujian & Pembaruan Data) |

Ganti password akun ini sebelum aplikasi dipakai orang lain.

## 6. Daftar endpoint

Semua response berformat `{ "success": bool, "message": string, "data": ... }`. Kalau ada error validasi, response juga berisi `errors`.

Endpoint yang butuh login memakai header `Authorization: Bearer <token>`. Contoh lengkap ada di `mount-tracker-backend/tests/api.http`.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/` | Status server dan database |
| POST | `/register`, `/login`, `/forgot`, `/reset`, `/auth/google` | Auth (login bisa pakai email atau username) |
| GET/PUT | `/me` | Profil |
| GET | `/mountains?q=&difficulty=easy\|medium\|extreme` | Daftar dan pencarian gunung |
| GET | `/mountains/{id}`, `/mountains/{id}/trails`, `/trails/{id}`, `/trails/{id}/checkpoints` | Detail, jalur, pos |
| POST/PUT/DELETE | `/mountains…`, `/trails…`, `/checkpoints/{id}` | Khusus admin |
| GET/POST | `/trips` (`?status=&include=locations`) | Riwayat / buat pendakian |
| GET | `/trips/active` | Pendakian aktif (atau rencana terdekat) + status pos + estimasi |
| GET | `/trips/{id}` | Detail + jejak GPS |
| POST | `/trips/{id}/start` \| `finish` \| `cancel` | Ubah status |
| POST | `/trips/{id}/locations` | Simpan lokasi GPS (1 titik atau `{locations:[…]}`) |
| GET/POST | `/trips/{id}/checkpoints`, `/trips/{id}/checkins` | Status pos / check-in |
| GET/POST | `/health` (`?tripId=&limit=`) | Data kesehatan + flag `spo2Low` |
| GET/POST | `/sos`, POST `/sos/{id}/resolve` | SOS (lat, lng, waktu). `/emergencies` = alias lama |
| GET/POST/PUT/DELETE | `/contacts`, `/contacts/{id}`, PUT `/contacts/{id}/primary` | Kontak darurat |
| GET | `/weather?lat=&lng=&hours=` atau `?mountainId=` | Cuaca per jam (Open-Meteo) |
| GET/POST | `/issues` | Laporan kendala |

## 7. Struktur backend

```
mount-tracker-backend/
├── public/index.php        # satu-satunya pintu masuk (front controller)
├── public/.htaccess        # rewrite untuk Apache
├── public/images/          # foto gunung
├── config/config.php       # baca .env
├── config/routes.php       # daftar endpoint
├── src/Core/               # Router, Request, Response, Database (PDO), Jwt, Validator, Mailer, Env
├── src/Middleware/         # Auth (JWT), Admin, Cors
├── src/Controllers/        # Auth, Mountain, Trip (+check-in), Health, Sos, Contact, Weather, Issue
├── src/Models/             # User, Mountain, Trail, Trip, Checkin (estimasi), HealthLog, Contact, Emergency
├── database/schema.sql     # tabel + foreign key + index
├── database/seed.sql       # data awal + akun demo
├── tests/api_test.php      # tes otomatis semua endpoint
└── tests/api.http          # koleksi request manual
```

Keamanan yang sudah diterapkan:

- PDO prepared statement
- `password_hash` (bcrypt)
- JWT HS256 dengan secret dari `.env`
- validasi semua input
- kode reset password 6 digit (disimpan dalam bentuk hash, berlaku 15 menit, maksimal 5 kali salah)
- CORS bisa diatur
- `.env` tidak bisa diakses lewat web

---

## 8. Checklist "siap pakai"

### Sudah selesai dan dites

- [x] Backend terstruktur dengan response seragam, validasi, JWT, dan CORS.
- [x] 107 tes endpoint lulus.
- [x] Schema dengan foreign key dan index, plus seed: 4 gunung, 6 pos Sembalun, 2 akun demo.
- [x] Semua layar memakai data asli dari API. Riwayat contoh dan angka hardcode sudah dihapus.
- [x] Loading state dan error state (dengan tombol "Coba lagi") di setiap layar yang memanggil API.
- [x] Maps sesuai aturan A, termasuk check-in pos dan estimasi jam sampai.
- [x] Tema terang/gelap sesuai aturan B. Semua warna hardcode di layar sudah diganti token tema.
- [x] Reset password lewat email: Gmail SMTP, atau Mailpit kalau SMTP kosong.
- [x] Kesehatan otomatis (pedometer + simulasi) dan cuaca per jam.
- [x] 75 unit test frontend lulus, dan bundel Android ter-compile tanpa error.
- [x] Alur register → login → pilih gunung → Maps → check-in → ganti tema berhasil di versi web.

### Masih harus kamu lakukan manual

- [ ] **Import database** ke `mount_tracker` (bagian 2.2). Backup dulu kalau ada data lama.
  - Saat pengembangan, tes dijalankan di database terpisah `mount_tracker_test`, dan `.env` lokal masih menunjuk ke sana.
  - Ubah `DB_NAME=mount_tracker` setelah import.
  - Database `mount_tracker_test` boleh dihapus.
- [ ] Set `APP_DEBUG=false` untuk dipakai sungguhan.
- [ ] Isi **App Password Gmail** di `.env` (bagian 2.3).
- [ ] Buat **Google OAuth Client ID**, lalu isi di kedua file `.env` (bagian 3.3).
- [ ] Isi IP laptop di `mobile/.env` dan izinkan port 8000 di firewall (bagian 2.5).
- [ ] **Tes di HP asli** memakai daftar di `TESTING.md`. GPS, pedometer, peta native, dan login Google belum bisa dites dari laptop.
- [ ] Ganti password akun demo, atau hapus akunnya.
- [ ] Ganti koordinat dan jarak pos (yang ditandai data contoh) dengan data survei resmi.
- [ ] **Kalau ingin build APK sendiri** (`eas build`):
  - Tambahkan API key Google Maps di `app.json` (`android.config.googleMaps.apiKey`).
  - Pakai HTTPS untuk backend, atau izinkan HTTP (*cleartext*) lewat `expo-build-properties`. Build release Android memblokir `http://`.
- [ ] Hosting backend di server dengan HTTPS kalau aplikasi akan dipakai di luar jaringan lokal.
