CREATE DATABASE IF NOT EXISTS mount_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mount_tracker;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_resets (
  user_id INT UNSIGNED PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE mountains (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  elevation_mdpl INT UNSIGNED NOT NULL,
  difficulty ENUM('easy','medium','extreme') NOT NULL DEFAULT 'easy',
  province VARCHAR(100) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  description TEXT NULL,
  image_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (name)
);

CREATE TABLE trails (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mountain_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  basecamp_name VARCHAR(120) NULL,
  basecamp_lat DECIMAL(9,6) NULL,
  basecamp_lng DECIMAL(9,6) NULL,
  distance_km DECIMAL(6,2) NULL,
  est_hours DECIMAL(5,1) NULL,
  UNIQUE KEY uq_trail (mountain_id, name),
  FOREIGN KEY (mountain_id) REFERENCES mountains(id) ON DELETE CASCADE
);

CREATE TABLE emergency_contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  relationship VARCHAR(60) NOT NULL DEFAULT '',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE trips (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  mountain_id INT UNSIGNED NOT NULL,
  trail_name VARCHAR(150) NOT NULL,
  group_size INT UNSIGNED NOT NULL DEFAULT 1,
  planned_days INT UNSIGNED NOT NULL DEFAULT 1,
  start_date DATETIME NOT NULL,
  expected_return_at DATETIME NOT NULL,
  contact_id INT UNSIGNED NULL,
  notes TEXT NULL,
  status ENUM('planned','active','finished','cancelled') NOT NULL DEFAULT 'planned',
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mountain_id) REFERENCES mountains(id),
  FOREIGN KEY (contact_id) REFERENCES emergency_contacts(id) ON DELETE SET NULL
);

CREATE TABLE trip_locations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id INT UNSIGNED NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  altitude_m INT NULL,
  accuracy_m FLOAT NULL,
  source ENUM('gps','network','manual','unavailable') NOT NULL DEFAULT 'gps',
  recorded_at DATETIME NOT NULL,
  INDEX (trip_id, recorded_at),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE emergency_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  trip_id INT UNSIGNED NULL,
  type ENUM('sos','lost','injury','weather','other') NOT NULL DEFAULT 'sos',
  message TEXT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  altitude_m INT NULL,
  accuracy_m FLOAT NULL,
  source ENUM('gps','network','manual','unavailable') NOT NULL DEFAULT 'gps',
  status ENUM('active','resolved','cancelled') NOT NULL DEFAULT 'active',
  triggered_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  INDEX (user_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL
);

CREATE TABLE issues (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Data awal sama dengan mobile/src/data.js (koordinat sengaja dikosongkan, isi sendiri nanti)
INSERT INTO mountains (name, elevation_mdpl, difficulty) VALUES
('Rinjani', 3726, 'easy'),
('Gede', 2958, 'easy'),
('Pangrango', 3019, 'medium'),
('Carstensz', 4884, 'extreme');

INSERT INTO trails (mountain_id, name) VALUES
(1, 'Rinjani via Sembalun'),
(1, 'Rinjani via Senaru'),
(2, 'Gede via Cibodas'),
(2, 'Gede via Gunung Putri'),
(3, 'Pangrango via Cibodas'),
(4, 'Carstensz (jalur utama)');
