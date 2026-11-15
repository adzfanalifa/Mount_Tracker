<?php
declare(strict_types=1);

use App\Core\Env;

// Semua nilai dibaca dari file .env (lihat .env.example).
return [
    'app_name' => Env::get('APP_NAME', 'Mount Tracker API'),
    'debug' => Env::bool('APP_DEBUG', false),
    'url' => Env::get('APP_URL'), // opsional; kosong = otomatis dari request
    'timezone' => Env::get('APP_TIMEZONE', 'Asia/Jakarta'),

    'db' => [
        'host' => Env::get('DB_HOST', '127.0.0.1'),
        'port' => Env::int('DB_PORT', 3306),
        'name' => Env::get('DB_NAME', 'mount_tracker'),
        'user' => Env::get('DB_USER', 'root'),
        'pass' => Env::get('DB_PASS', ''),
    ],

    'jwt' => [
        'secret' => Env::get('JWT_SECRET', ''),
        'ttl' => Env::int('JWT_TTL', 60 * 60 * 24 * 7),
    ],

    'cors_origin' => Env::get('CORS_ORIGIN', '*'),

    'mail' => [
        // Kosongkan MAIL_USERNAME untuk memakai Mailpit lokal (Laragon) tanpa login.
        'host' => Env::get('MAIL_HOST', '127.0.0.1'),
        'port' => Env::int('MAIL_PORT', 1025),
        'username' => Env::get('MAIL_USERNAME'),
        'password' => Env::get('MAIL_PASSWORD'),
        'encryption' => Env::get('MAIL_ENCRYPTION', ''), // tls | ssl | kosong
        'from' => Env::get('MAIL_FROM_ADDRESS', 'no-reply@mounttracker.local'),
        'from_name' => Env::get('MAIL_FROM_NAME', 'Mount Tracker'),
    ],

    'google_client_ids' => array_values(array_filter(array_map('trim', explode(',', (string) Env::get('GOOGLE_CLIENT_IDS', ''))))),

    'weather' => [
        'base_url' => Env::get('OPEN_METEO_URL', 'https://api.open-meteo.com/v1/forecast'),
        'cache_ttl' => Env::int('WEATHER_CACHE_TTL', 900),
    ],

    'health' => [
        'spo2_low' => Env::int('SPO2_LOW', 90),
        'spo2_critical' => Env::int('SPO2_CRITICAL', 85),
    ],
];
