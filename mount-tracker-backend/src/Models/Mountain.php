<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;

final class Mountain
{
    public const DIFFICULTY = ['easy', 'medium', 'extreme'];

    public static function find(int $id): ?array
    {
        return DB::one('SELECT * FROM mountains WHERE id=?', [$id]);
    }

    public static function search(?string $q, ?string $difficulty): array
    {
        $where = [];
        $p = [];
        if ($q !== null && $q !== '') { $where[] = '(name LIKE ? OR province LIKE ?)'; $p[] = Fmt::like($q); $p[] = Fmt::like($q); }
        if ($difficulty) { $where[] = 'difficulty = ?'; $p[] = $difficulty; }
        $sql = 'SELECT * FROM mountains' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY name';
        return DB::all($sql, $p);
    }

    public static function imageUrl(?string $v, string $baseUrl): ?string
    {
        if (!$v) return null;
        if (preg_match('#^https?://#i', $v)) return $v;
        return $baseUrl . '/images/' . rawurlencode($v);
    }

    /** 'trails' = daftar nama (dipakai form rencana), 'trailDetails' = info lengkap. */
    public static function format(array $m, array $trails, string $baseUrl): array
    {
        return [
            'id' => (int) $m['id'],
            'name' => $m['name'],
            'elevationMdpl' => (int) $m['elevation_mdpl'],
            'difficulty' => $m['difficulty'],
            'province' => $m['province'],
            'latitude' => Fmt::float($m['latitude']),
            'longitude' => Fmt::float($m['longitude']),
            'description' => $m['description'],
            'imageUrl' => self::imageUrl($m['image_url'] ?? null, $baseUrl),
            'trails' => array_map(fn($t) => $t['name'], $trails),
            'trailDetails' => array_map(fn($t) => Trail::format($t, $t['checkpoints'] ?? null), $trails),
        ];
    }
}
