-- Mount Tracker - data awal. Jalankan setelah schema.sql.
USE mount_tracker;

-- ---------------------------------------------------------------- akun demo
-- demo  / demo1234   (user biasa)
-- admin / admin1234  (admin: bisa buka Status Pengujian & Pembaruan Data)
INSERT INTO users (id, username, email, password_hash, display_name, role) VALUES
(1, 'demo',  'demo@mounttracker.local',  '$2y$10$SpGy06V.CzuL3He6oWC9KeCQFGXOiKFDgcPIScQJreoenUtQ48fGi', 'Pendaki Demo', 'user'),
(2, 'admin', 'admin@mounttracker.local', '$2y$10$ke5fvHCAxHUkwhrV/TrUQuU3OzpDbnm2vQa6Ngcy..8iuITHAHhUm', 'Admin', 'admin');

-- Kontak darurat contoh (nomor fiktif) agar akun demo bisa langsung membuat rencana pendakian
INSERT INTO emergency_contacts (user_id, name, phone, relationship, is_primary) VALUES
(1, 'Kontak Demo', '081200000000', 'Keluarga', 1);

-- ---------------------------------------------------------------- gunung
-- Koordinat = perkiraan titik puncak.
INSERT INTO mountains (id, name, elevation_mdpl, difficulty, province, latitude, longitude, description, image_url) VALUES
(1, 'Rinjani',   3726, 'easy',    'Nusa Tenggara Barat', -8.411900, 116.457200, 'Gunung api tertinggi kedua di Indonesia, terkenal dengan Danau Segara Anak.', 'rinjani.jpg'),
(2, 'Gede',      2958, 'easy',    'Jawa Barat',          -6.785300, 106.981000, 'Gunung api aktif di Taman Nasional Gede Pangrango dengan kawah dan alun-alun Suryakencana.', 'gede.jpg'),
(3, 'Pangrango', 3019, 'medium',  'Jawa Barat',          -6.769700, 106.963000, 'Kembaran Gunung Gede dengan lembah edelweis Mandalawangi.', 'pangrango.jpg'),
(4, 'Carstensz', 4884, 'extreme', 'Papua Tengah',        -4.083300, 137.183300, 'Puncak Jaya, titik tertinggi Indonesia; butuh teknik panjat tebing dan izin khusus.', 'carstensz.jpg');

-- ---------------------------------------------------------------- jalur
INSERT INTO trails (id, mountain_id, name, basecamp_name, basecamp_lat, basecamp_lng, basecamp_elevation, distance_km, est_hours) VALUES
(1, 1, 'Rinjani via Sembalun',   'Basecamp Sembalun', -8.362000, 116.531000, 1150, 13.50, 14.0),
(2, 1, 'Rinjani via Senaru',     'Basecamp Senaru',   -8.306000, 116.406000,  600, NULL, NULL),
(3, 2, 'Gede via Cibodas',       'Basecamp Cibodas',  -6.740600, 106.999700, 1275, NULL, NULL),
(4, 2, 'Gede via Gunung Putri',  'Basecamp Gunung Putri', -6.763000, 107.029000, 1450, NULL, NULL),
(5, 3, 'Pangrango via Cibodas',  'Basecamp Cibodas',  -6.740600, 106.999700, 1275, NULL, NULL),
(6, 4, 'Carstensz (jalur utama)', 'Lembah Kuning',    -4.067000, 137.170000, 4200, NULL, NULL);

-- ---------------------------------------------------------------- pos Rinjani via Sembalun
-- DATA CONTOH: koordinat semua pos adalah PERKIRAAN (is_sample = 1), bukan hasil survei GPS.
-- Jarak Plawangan (9.6 km) dan Puncak (13.5 km) juga perkiraan; ganti dengan data resmi bila ada.
INSERT INTO checkpoints (trail_id, seq, name, elevation_mdpl, distance_km, latitude, longitude, is_sample) VALUES
(1, 1, 'Pos 1 Sembalun', 1156,  1.20, -8.372000, 116.522500, 1),
(1, 2, 'Pos 2',          1800,  3.40, -8.383500, 116.511000, 1),
(1, 3, 'Pos 3',          2100,  5.10, -8.390500, 116.501000, 1),
(1, 4, 'Pos 4',          2400,  6.80, -8.396000, 116.490000, 1),
(1, 5, 'Plawangan',      2639,  9.60, -8.399000, 116.475500, 1),
(1, 6, 'Puncak',         3726, 13.50, -8.411900, 116.457200, 1);
