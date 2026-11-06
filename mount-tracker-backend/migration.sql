-- Jalankan SEKALI di HeidiSQL (File > Run SQL file) untuk database yang sudah ada.
USE mount_tracker;

ALTER TABLE mountains ADD COLUMN image_url VARCHAR(255) NULL AFTER description;

-- Koordinat PERKIRAAN puncak (supaya muncul penanda di peta). Boleh diganti yang lebih tepat.
UPDATE mountains SET latitude = -8.4119, longitude = 116.4572 WHERE name = 'Rinjani';
UPDATE mountains SET latitude = -6.7667, longitude = 106.9833 WHERE name = 'Gede';
UPDATE mountains SET latitude = -6.7667, longitude = 106.9500 WHERE name = 'Pangrango';
UPDATE mountains SET latitude = -4.0833, longitude = 137.1833 WHERE name = 'Carstensz';

-- Foto: taruh file di folder images, lalu isi nama filenya. Contoh (hapus tanda -- kalau fotonya sudah ada):
-- UPDATE mountains SET image_url = 'rinjani.jpg'   WHERE name = 'Rinjani';
-- UPDATE mountains SET image_url = 'gede.jpg'      WHERE name = 'Gede';
-- UPDATE mountains SET image_url = 'pangrango.jpg' WHERE name = 'Pangrango';
-- UPDATE mountains SET image_url = 'carstensz.jpg' WHERE name = 'Carstensz';
