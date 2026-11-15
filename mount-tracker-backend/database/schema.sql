-- Mount Tracker - struktur database (MySQL 8 / MariaDB 10.5+)
-- PERINGATAN: menghapus dan membuat ulang database mount_tracker.
-- Import di HeidiSQL: File > Run SQL file > schema.sql, lalu seed.sql

DROP DATABASE IF EXISTS mount_tracker;
CREATE DATABASE mount_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mount_tracker;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL DEFAULT '',
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  google_sub VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google (google_sub)
) ENGINE=InnoDB;

-- Kode reset password (hash SHA-256 dari kode 6 digit)
CREATE TABLE password_resets (
  user_id INT UNSIGNED PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mountains_name (name),
  KEY idx_mountains_difficulty (difficulty)
) ENGINE=InnoDB;

CREATE TABLE trails (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mountain_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  basecamp_name VARCHAR(120) NULL,
  basecamp_lat DECIMAL(9,6) NULL,
  basecamp_lng DECIMAL(9,6) NULL,
  basecamp_elevation INT UNSIGNED NULL,
  distance_km DECIMAL(6,2) NULL,
  est_hours DECIMAL(5,1) NULL,
  UNIQUE KEY uq_trail (mountain_id, name),
  CONSTRAINT fk_trails_mountain FOREIGN KEY (mountain_id) REFERENCES mountains(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pos di sebuah jalur. distance_km = jarak kumulatif dari basecamp.
CREATE TABLE checkpoints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trail_id INT UNSIGNED NOT NULL,
  seq SMALLINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  elevation_mdpl INT UNSIGNED NOT NULL,
  distance_km DECIMAL(6,2) NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  is_sample TINYINT(1) NOT NULL DEFAULT 0, -- 1 = koordinat/jarak perkiraan (data contoh)
  UNIQUE KEY uq_checkpoint_seq (trail_id, seq),
  CONSTRAINT fk_checkpoints_trail FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE emergency_contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  relationship VARCHAR(60) NOT NULL DEFAULT '',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_contacts_user (user_id, is_primary),
  CONSTRAINT fk_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE trips (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  mountain_id INT UNSIGNED NOT NULL,
  trail_id INT UNSIGNED NULL,
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trips_user_status (user_id, status),
  KEY idx_trips_user_start (user_id, start_date),
  CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trips_mountain FOREIGN KEY (mountain_id) REFERENCES mountains(id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_trail FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE SET NULL,
  CONSTRAINT fk_trips_contact FOREIGN KEY (contact_id) REFERENCES emergency_contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE trip_locations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id INT UNSIGNED NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  altitude_m INT NULL,
  accuracy_m FLOAT NULL,
  source ENUM('gps','network','manual','unavailable') NOT NULL DEFAULT 'gps',
  recorded_at DATETIME NOT NULL,
  KEY idx_locations_trip_time (trip_id, recorded_at),
  CONSTRAINT fk_locations_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Check-in: waktu sampai di sebuah pos
CREATE TABLE trip_checkins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id INT UNSIGNED NOT NULL,
  checkpoint_id INT UNSIGNED NOT NULL,
  arrived_at DATETIME NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_checkin (trip_id, checkpoint_id),
  KEY idx_checkins_trip_time (trip_id, arrived_at),
  CONSTRAINT fk_checkins_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkins_checkpoint FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE health_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  trip_id INT UNSIGNED NULL,
  recorded_at DATETIME NOT NULL,
  bpm SMALLINT UNSIGNED NULL,
  altitude_m INT NULL,
  spo2 TINYINT UNSIGNED NULL,
  temperature_c DECIMAL(4,1) NULL,
  steps INT UNSIGNED NULL,
  calories INT UNSIGNED NULL,
  is_simulated TINYINT(1) NOT NULL DEFAULT 0,
  spo2_low TINYINT(1) NOT NULL DEFAULT 0, -- flag peringatan SpO2 rendah
  KEY idx_health_user_time (user_id, recorded_at),
  KEY idx_health_trip (trip_id),
  CONSTRAINT fk_health_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_health_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL
) ENGINE=InnoDB;

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
  KEY idx_emergency_user_status (user_id, status),
  CONSTRAINT fk_emergency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_emergency_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE issues (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Lainnya',
  description TEXT NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL,
  KEY idx_issues_user (user_id),
  CONSTRAINT fk_issues_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
