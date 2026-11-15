<?php
declare(strict_types=1);

namespace App\Core;

/** JWT HS256 tanpa library eksternal. */
final class Jwt
{
    private static function b64e(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
    private static function b64d(string $s): string|false { return base64_decode(strtr($s, '-_', '+/'), true); }

    private static function secret(): string
    {
        $s = (string) App::config('jwt.secret');
        if (strlen($s) < 32) throw new \RuntimeException('JWT_SECRET di .env belum diisi (minimal 32 karakter)');
        return $s;
    }

    public static function encode(array $payload): string
    {
        $now = time();
        $payload += ['iat' => $now, 'exp' => $now + (int) App::config('jwt.ttl')];
        $h = self::b64e(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $p = self::b64e(json_encode($payload));
        return "$h.$p." . self::b64e(hash_hmac('sha256', "$h.$p", self::secret(), true));
    }

    public static function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;
        $head = json_decode((string) self::b64d($h), true);
        if (($head['alg'] ?? '') !== 'HS256') return null;
        if (!hash_equals(self::b64e(hash_hmac('sha256', "$h.$p", self::secret(), true)), $s)) return null;
        $payload = json_decode((string) self::b64d($p), true);
        if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) return null;
        return $payload;
    }
}
