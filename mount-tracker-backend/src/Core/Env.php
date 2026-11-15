<?php
declare(strict_types=1);

namespace App\Core;

/** Pembaca file .env sederhana (KEY=VALUE, komentar diawali #). */
final class Env
{
    private static array $vars = [];

    public static function load(string $file): void
    {
        if (!is_file($file)) return;
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim(preg_replace('/^\xEF\xBB\xBF/', '', $line)); // buang BOM
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) {
                $v = substr($v, 1, -1);
            } elseif (($p = strpos($v, ' #')) !== false) {
                $v = rtrim(substr($v, 0, $p));
            }
            self::$vars[$k] = $v;
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $v = self::$vars[$key] ?? getenv($key);
        return ($v === false || $v === null || $v === '') ? $default : (string) $v;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        return $v === null ? $default : in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    }

    public static function int(string $key, int $default): int
    {
        $v = self::get($key);
        return is_numeric($v) ? (int) $v : $default;
    }
}
