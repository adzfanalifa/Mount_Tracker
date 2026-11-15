# TESTING – Mount Tracker

Dokumen ini berisi:

1. tes otomatis yang sudah ada,
2. langkah tes manual di HP.

## 1. Tes otomatis

| Bagian | Perintah | Hasil terakhir |
|---|---|---|
| Backend: semua endpoint | `php tests/api_test.php http://127.0.0.1:8000` (dari folder `mount-tracker-backend`) | 107 lulus, 0 gagal |
| Frontend: unit test (model, validasi, service API, simulasi kesehatan, tema) | `npm test` (dari folder `mobile`) | 75 lulus, 0 gagal |
| Frontend: bundel Android tanpa error | `npm run check:bundle` (dari folder `mobile`) | berhasil |
| Alur di browser (Expo web) | `npx expo start --web` | register → login → pilih gunung → Maps menampilkan pos → check-in → ganti tema: berhasil |

Ada juga koleksi request manual di `mount-tracker-backend/tests/api.http`. Buka dengan ekstensi VS Code "REST Client".

Syarat sebelum menjalankan `api_test.php`:

- Database sudah di-import dari `database/schema.sql` dan `database/seed.sql`.
- Server backend sedang berjalan.
- `APP_DEBUG=true` di `.env`. Dengan ini kode reset password ikut dikirim di response, jadi tes bisa memakainya.
- Mailpit Laragon berjalan, atau SMTP Gmail sudah diisi.

Skrip ini membuat user baru dengan nama acak, jadi aman dijalankan berulang kali.

Lint dan type-check tidak tersedia, karena proyek memakai JavaScript tanpa ESLint/TypeScript. Sebagai gantinya, kode diperiksa lewat `npm run check:bundle`, yang meng-compile seluruh aplikasi.

## 2. Tes manual di HP

### Persiapan

1. Laptop dan HP harus tersambung ke WiFi yang sama.
2. Jalankan MySQL dari Laragon (klik **Start All**).
3. Jalankan backend: `php -S 0.0.0.0:8000 -t public public/index.php` dari folder `mount-tracker-backend`.
4. Dari browser HP, buka `http://IP-LAPTOP:8000/`. Harus muncul `"success":true` dan `"database":"ok"`.
   - Kalau tidak bisa dibuka, lihat bagian *Firewall* di README.
5. Isi `EXPO_PUBLIC_API_URL=http://IP-LAPTOP:8000` di `mobile/.env`.
6. Jalankan `npx expo start -c`, lalu scan QR dengan aplikasi **Expo Go**.

### Daftar tes

Beri tanda ✅ atau ❌ di setiap baris.

| No | Langkah | Hasil yang diharapkan | ✅/❌ |
|---|---|---|---|
| 1 | Buka aplikasi. Di layar Sign In, ketuk **Server: …**, isi IP laptop, lalu **Simpan & Tes Koneksi** | Muncul "Terhubung … database ok" | |
| 2 | **Create New Account**: isi username, email, password, dan konfirmasi | Masuk ke Home | |
| 3 | Daftar lagi dengan username yang sama | Muncul pesan "Username sudah dipakai" | |
| 4 | Profil (ikon orang di kanan atas) → **Keluar**, lalu login memakai **email** | Masuk ke Home | |
| 5 | Logout, lalu login memakai **username** `demo` dan password `demo1234` | Masuk ke Home | |
| 6 | Login dengan password salah | Muncul kotak merah "Email/username atau password salah" | |
| 7 | **Forgot Password?** → isi username dan email akunmu | Pindah ke layar kode. Kode masuk ke Gmail, atau ke Mailpit di `http://localhost:8025` | |
| 8 | Isi kode, password baru, dan konfirmasi | Muncul "Password sudah diganti". Login dengan password baru berhasil | |
| 9 | Ketuk **Masuk dengan Google** | Kalau belum dikonfigurasi: muncul pesan "belum dikonfigurasi". Kalau sudah: login berhasil | |
| 10 | Buka tab **Maps** sebelum memilih gunung | Peta tampil (titik biru posisi HP kalau izin lokasi diberikan). Tidak ada daftar pos. Ada teks "Pilih gunung di tab Mount untuk melihat jalur" | |
| 11 | Tab **Mount** → ketik "rin" di pencarian | Hanya Rinjani yang tampil | |
| 12 | Ketuk filter **Extreme** | Hanya Carstensz yang tampil | |
| 13 | Rinjani → **Tambahkan Pendakian** | Form Rencana terbuka dengan Rinjani terpilih | |
| 14 | Kembali, lalu buka tab **Maps** | Peta zoom ke Rinjani, ada marker 6 pos dan garis jalur. Di bawahnya ada daftar pos (nama, mdpl, km) | |
| 15 | Home → Kontak → tambah kontak dengan nomor `abc` | Muncul pesan "Nomor telepon harus 8-15 angka" | |
| 16 | Tambah kontak yang benar | Kontak tampil dengan tanda bintang (utama) | |
| 17 | Mount → Rinjani → **Tambahkan Pendakian** → pilih jalur Sembalun → **Simpan Rencana** | Muncul "Rencana tersimpan". Home menampilkan status Direncanakan | |
| 18 | Home → **Mulai Pendakian** (izinkan lokasi dan aktivitas fisik) | Status menjadi Aktif dan durasi berjalan | |
| 19 | Maps → ketuk **Pos 1 Sembalun** → **Check-in** | Ikon Pos 1 berubah menjadi lokasi merah dengan jam sampai. Pos berikutnya menampilkan "Est. JJ:MM" | |
| 20 | Ketuk Pos 1 lagi | Muncul "Sudah check-in pukul …" | |
| 21 | Tunggu ±1 menit, lalu buka Maps | Garis kuning jejak GPS mulai muncul kalau kamu bergerak | |
| 22 | Tab **Health** | Ada data detak jantung, SpO2, suhu, dan ketinggian (label simulasi). Langkah bertambah kalau HP dibawa berjalan | |
| 23 | Health → **Ukur Sekarang** beberapa kali | Grafik batang terisi. Kalau SpO2 < 90% muncul peringatan kuning | |
| 24 | Home → kartu **Cuaca Per Jam** | Ada suhu per jam untuk gunung Rinjani | |
| 25 | Ikon matahari/bulan di pojok kanan atas | Tema berganti terang ↔ gelap di semua layar | |
| 26 | Tutup aplikasi lalu buka lagi | Tema yang dipilih tetap sama, akun masih login, pendakian masih Aktif | |
| 27 | Profil → Tampilan → **Ikuti sistem**, lalu ganti mode gelap di pengaturan HP | Tema aplikasi ikut berubah | |
| 28 | Home → **SOS** → tunggu hitung mundur | Muncul "SOS tersimpan di server" beserta koordinat | |
| 29 | Matikan WiFi, lalu tekan SOS | Muncul "SOS belum terkirim ke server" dan tombol telepon tetap bisa dipakai | |
| 30 | Nyalakan WiFi. Home → **Akhiri Pendakian** | Pendakian masuk ke Riwayat. Maps kembali ke gunung terpilih | |
| 31 | Home → **Riwayat** → buka pendakian tadi | Ada jejak, jarak, dan waktu | |
| 32 | Home → **Status** | Semua baris hijau: server, izin lokasi, GPS, internet, kontak | |
| 33 | Matikan server backend, lalu tarik layar Home ke bawah | Muncul kotak merah "Tidak dapat terhubung ke server…" dengan tombol **Coba lagi** | |
| 34 | Login sebagai `admin` / `admin1234` | Menu Pengujian dan Data tampil. Status Pengujian semuanya lulus | |

### Catatan

- Di Expo Go, peta Android memakai Google Maps bawaan Expo Go. Untuk build APK sendiri, kamu perlu API key Google Maps (lihat README).
- Login Google paling stabil dites di *development build* (`npx expo run:android`). Di Expo Go, redirect Google bisa ditolak.
- Detak jantung, SpO2, dan suhu adalah **simulasi**, karena HP tidak punya sensornya. Langkah memakai pedometer HP, dan ketinggian diambil dari GPS atau dari pos terakhir yang di-check-in.
