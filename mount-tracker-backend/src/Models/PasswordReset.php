<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;

/** Kode reset 6 digit, disimpan dalam bentuk hash, berlaku 15 menit, maksimal 5 kali salah. */
final class PasswordReset
{
    public const TTL_MINUTES = 15;
    public const MAX_ATTEMPTS = 5;

    public static function issue(int $userId): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        DB::run('REPLACE INTO password_resets (user_id, code_hash, attempts, expires_at, created_at) VALUES (?,?,0,?,?)', [
            $userId, hash('sha256', $code), date('Y-m-d H:i:s', time() + self::TTL_MINUTES * 60), Fmt::now(),
        ]);
        return $code;
    }

    /** @return string|null pesan error, null jika kode benar */
    public static function verify(int $userId, string $code): ?string
    {
        $r = DB::one('SELECT * FROM password_resets WHERE user_id=?', [$userId]);
        if (!$r || strtotime($r['expires_at']) < time()) return 'Kode reset tidak valid atau sudah kedaluwarsa. Minta kode baru.';
        if ((int) $r['attempts'] >= self::MAX_ATTEMPTS) return 'Terlalu banyak percobaan. Minta kode baru.';
        if (!hash_equals($r['code_hash'], hash('sha256', $code))) {
            DB::run('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id=?', [$userId]);
            return 'Kode reset salah';
        }
        return null;
    }

    public static function clear(int $userId): void
    {
        DB::run('DELETE FROM password_resets WHERE user_id=?', [$userId]);
    }
}
