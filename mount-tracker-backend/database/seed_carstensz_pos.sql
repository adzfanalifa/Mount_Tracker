-- Pos jalur "Carstensz (jalur utama)" (trail_id = 6).
--
-- STATUS: TEMPLATE, BELUM BISA DIJALANKAN.
-- Data pos Carstensz (nama, koordinat, ketinggian, jarak) belum tersedia dan TIDAK dikarang.
-- Isi semua nilai bertanda TODO dari sumber resmi / hasil survei GPS, lalu hapus tanda komentar (--)
-- pada blok INSERT dan jalankan file ini di HeidiSQL (File > Run SQL file).
-- File ini hanya MENAMBAH baris; data lain tidak diubah atau dihapus.
--
-- Aturan kolom:
--   seq            urutan pos, mulai 1 (unik per jalur)
--   name           nama pos
--   elevation_mdpl ketinggian (meter di atas permukaan laut)
--   distance_km    jarak KUMULATIF dari basecamp (boleh NULL jika tidak diketahui)
--   latitude/longitude  wajib diisi (NOT NULL), format desimal, contoh -4.083300 / 137.183300
--   is_sample      1 = perkiraan/data contoh, 0 = data terverifikasi
--
-- Data yang sudah ada di seed.sql (juga perkiraan, periksa kembali bila punya data resmi):
--   basecamp jalur 6 : "Lembah Kuning", -4.067000, 137.170000, 4200 mdpl
--   puncak gunung 4  : -4.083300, 137.183300, 4884 mdpl

USE mount_tracker;

-- Cegah duplikat: pastikan jalur ini belum punya pos sebelum menjalankan INSERT.
SELECT COUNT(*) AS pos_sekarang FROM checkpoints WHERE trail_id = 6;

-- INSERT INTO checkpoints (trail_id, seq, name, elevation_mdpl, distance_km, latitude, longitude, is_sample) VALUES
-- (6, 1, 'TODO nama pos 1', 0 /* TODO mdpl */, NULL /* TODO km */, 0.000000 /* TODO lat */, 0.000000 /* TODO lng */, 1),
-- (6, 2, 'TODO nama pos 2', 0 /* TODO mdpl */, NULL /* TODO km */, 0.000000 /* TODO lat */, 0.000000 /* TODO lng */, 1),
-- (6, 3, 'Puncak Carstensz', 4884, NULL /* TODO km */, -4.083300 /* TODO verifikasi */, 137.183300 /* TODO verifikasi */, 1);

-- Opsional: isi total jarak & estimasi jam jalur bila sudah diketahui.
-- UPDATE trails SET distance_km = NULL /* TODO */, est_hours = NULL /* TODO */ WHERE id = 6;
