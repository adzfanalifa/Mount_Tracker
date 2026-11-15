<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;

final class User
{
    public static function find(int $id): ?array
    {
        return DB::one('SELECT * FROM users WHERE id=?', [$id]);
    }

    /** Login bisa memakai email atau username. */
    public static function findByLogin(string $login): ?array
    {
        return DB::one('SELECT * FROM users WHERE email=? OR username=? LIMIT 1', [strtolower($login), $login]);
    }

    public static function findByEmail(string $email): ?array
    {
        return DB::one('SELECT * FROM users WHERE email=?', [strtolower($email)]);
    }

    public static function findByGoogleSub(string $sub): ?array
    {
        return DB::one('SELECT * FROM users WHERE google_sub=?', [$sub]);
    }

    public static function exists(string $username, string $email, int $exceptId = 0): array
    {
        return [
            'username' => (bool) DB::value('SELECT 1 FROM users WHERE username=? AND id<>?', [$username, $exceptId]),
            'email' => (bool) DB::value('SELECT 1 FROM users WHERE email=? AND id<>?', [strtolower($email), $exceptId]),
        ];
    }

    public static function create(array $f): array
    {
        $f['created_at'] = Fmt::now();
        return self::find(DB::insert('users', $f));
    }

    public static function update(int $id, array $f): array
    {
        DB::update('users', $id, $f);
        return self::find($id);
    }

    /** Buat username unik dari teks (dipakai login Google). */
    public static function uniqueUsername(string $base): string
    {
        $base = substr(preg_replace('/[^A-Za-z0-9_.]/', '', $base) ?: 'pendaki', 0, 24);
        if (strlen($base) < 3) $base = str_pad($base, 3, '0');
        $name = $base;
        for ($i = 1; DB::value('SELECT 1 FROM users WHERE username=?', [$name]); $i++) $name = $base . $i;
        return $name;
    }

    public static function format(array $u): array
    {
        return [
            'id' => (int) $u['id'],
            'username' => $u['username'],
            'email' => $u['email'],
            'displayName' => $u['display_name'] ?? '',
            'role' => $u['role'],
            'hasGoogle' => !empty($u['google_sub']),
            'createdAt' => Fmt::iso($u['created_at'] ?? null),
        ];
    }
}
