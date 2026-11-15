<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\HttpException;

/** Kontak darurat. Kontak pertama otomatis jadi utama; selalu tepat satu kontak utama. */
final class Contact
{
    public static function list(int $userId): array
    {
        return DB::all('SELECT * FROM emergency_contacts WHERE user_id=? ORDER BY is_primary DESC, id', [$userId]);
    }

    public static function findOwned(int $id, int $userId): array
    {
        return DB::one('SELECT * FROM emergency_contacts WHERE id=? AND user_id=?', [$id, $userId])
            ?? throw HttpException::notFound('Kontak tidak ditemukan');
    }

    public static function primary(int $userId): ?array
    {
        return DB::one('SELECT * FROM emergency_contacts WHERE user_id=? AND is_primary=1 LIMIT 1', [$userId]);
    }

    public static function count(int $userId): int
    {
        return (int) DB::value('SELECT COUNT(*) FROM emergency_contacts WHERE user_id=?', [$userId]);
    }

    public static function setPrimary(int $id, int $userId): void
    {
        DB::run('UPDATE emergency_contacts SET is_primary = (id = ?) WHERE user_id=?', [$id, $userId]);
    }

    public static function format(array $c): array
    {
        return [
            'id' => (int) $c['id'],
            'name' => $c['name'],
            'phone' => $c['phone'],
            'relationship' => $c['relationship'],
            'isPrimary' => (bool) $c['is_primary'],
        ];
    }
}
