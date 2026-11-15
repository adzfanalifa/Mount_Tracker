<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;

/** Jalur pendakian dan pos-pos (checkpoints) di dalamnya. */
final class Trail
{
    public static function find(int $id): ?array
    {
        return DB::one('SELECT * FROM trails WHERE id=?', [$id]);
    }

    public static function findByName(int $mountainId, string $name): ?array
    {
        return DB::one('SELECT * FROM trails WHERE mountain_id=? AND name=?', [$mountainId, $name]);
    }

    /** @return array<int, array> jalur dikelompokkan per mountain_id */
    public static function forMountains(array $ids): array
    {
        if (!$ids) return [];
        $in = implode(',', array_fill(0, count($ids), '?'));
        $rows = DB::all("SELECT t.*, (SELECT COUNT(*) FROM checkpoints c WHERE c.trail_id=t.id) AS checkpoint_count
                         FROM trails t WHERE t.mountain_id IN ($in) ORDER BY t.name", array_values($ids));
        $g = [];
        foreach ($rows as $r) $g[(int) $r['mountain_id']][] = $r;
        return $g;
    }

    public static function checkpoints(int $trailId): array
    {
        return DB::all('SELECT * FROM checkpoints WHERE trail_id=? ORDER BY seq', [$trailId]);
    }

    public static function findCheckpoint(int $id): ?array
    {
        return DB::one('SELECT * FROM checkpoints WHERE id=?', [$id]);
    }

    public static function format(array $t, ?array $checkpoints = null): array
    {
        $o = [
            'id' => (int) $t['id'],
            'mountainId' => (int) $t['mountain_id'],
            'name' => $t['name'],
            'basecampName' => $t['basecamp_name'],
            'basecampLat' => Fmt::float($t['basecamp_lat']),
            'basecampLng' => Fmt::float($t['basecamp_lng']),
            'basecampElevation' => Fmt::int($t['basecamp_elevation'] ?? null),
            'distanceKm' => Fmt::float($t['distance_km']),
            'estHours' => Fmt::float($t['est_hours']),
        ];
        if (isset($t['checkpoint_count'])) $o['checkpointCount'] = (int) $t['checkpoint_count'];
        if ($checkpoints !== null) {
            $o['checkpoints'] = array_map([self::class, 'formatCheckpoint'], $checkpoints);
            $o['checkpointCount'] = count($checkpoints);
        }
        return $o;
    }

    public static function formatCheckpoint(array $c): array
    {
        return [
            'id' => (int) $c['id'],
            'trailId' => (int) $c['trail_id'],
            'order' => (int) $c['seq'],
            'name' => $c['name'],
            'elevationMdpl' => (int) $c['elevation_mdpl'],
            'distanceKm' => Fmt::float($c['distance_km']),
            'latitude' => Fmt::float($c['latitude']),
            'longitude' => Fmt::float($c['longitude']),
            'isSample' => (bool) $c['is_sample'],
        ];
    }
}
