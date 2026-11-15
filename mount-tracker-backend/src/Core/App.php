<?php
declare(strict_types=1);

namespace App\Core;

/** Penyimpan konfigurasi global. */
final class App
{
    private static array $config = [];

    public static function boot(array $config): void
    {
        self::$config = $config;
        date_default_timezone_set($config['timezone']);
    }

    /** Ambil konfigurasi dengan notasi titik, contoh App::config('db.host'). */
    public static function config(string $key, mixed $default = null): mixed
    {
        $v = self::$config;
        foreach (explode('.', $key) as $part) {
            if (!is_array($v) || !array_key_exists($part, $v)) return $default;
            $v = $v[$part];
        }
        return $v;
    }

    public static function basePath(string $path = ''): string
    {
        return dirname(__DIR__, 2) . ($path ? DIRECTORY_SEPARATOR . $path : '');
    }
}
