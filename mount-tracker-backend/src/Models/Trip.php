<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;
use App\Core\HttpException;

final class Trip
{
    public const STATUS = ['planned', 'active', 'finished', 'cancelled'];

    private const SELECT = 'SELECT t.*, m.name AS mountain_name, m.latitude AS mountain_lat, m.longitude AS mountain_lng,
        m.elevation_mdpl AS mountain_elevation, m.difficulty AS mountain_difficulty
        FROM trips t JOIN mountains m ON m.id = t.mountain_id';

    public static function findOwned(int $id, int $userId): array
    {
        return DB::one(self::SELECT . ' WHERE t.id=? AND t.user_id=?', [$id, $userId])
            ?? throw HttpException::notFound('Pendakian tidak ditemukan');
    }

    public static function list(int $userId, ?string $status): array
    {
        $sql = self::SELECT . ' WHERE t.user_id=?';
        $p = [$userId];
        if ($status) { $sql .= ' AND t.status=?'; $p[] = $status; }
        return DB::all($sql . ' ORDER BY t.start_date DESC, t.id DESC', $p);
    }

    public static function active(int $userId): ?array
    {
        return DB::one(self::SELECT . " WHERE t.user_id=? AND t.status='active' ORDER BY t.id DESC LIMIT 1", [$userId]);
    }

    /** Pendakian yang sedang berjalan, atau rencana terdekat jika belum ada yang aktif. */
    public static function current(int $userId): ?array
    {
        return self::active($userId)
            ?? DB::one(self::SELECT . " WHERE t.user_id=? AND t.status='planned' ORDER BY t.start_date, t.id LIMIT 1", [$userId]);
    }

    public static function locations(int $tripId): array
    {
        return DB::all('SELECT * FROM trip_locations WHERE trip_id=? ORDER BY recorded_at, id', [$tripId]);
    }

    public static function lastKnownLocation(int $tripId): ?array
    {
        return DB::one("SELECT * FROM trip_locations WHERE trip_id=? AND source<>'unavailable' ORDER BY recorded_at DESC, id DESC LIMIT 1", [$tripId]);
    }

    public static function durationMinutes(array $t): int
    {
        if (!$t['started_at']) return 0;
        $end = $t['ended_at'] ? strtotime($t['ended_at']) : time();
        return max(0, intdiv($end - strtotime($t['started_at']), 60));
    }

    public static function format(array $t): array
    {
        return [
            'id' => (int) $t['id'],
            'mountainId' => (int) $t['mountain_id'],
            'mountainName' => $t['mountain_name'],
            'mountain' => [
                'id' => (int) $t['mountain_id'],
                'name' => $t['mountain_name'],
                'elevationMdpl' => (int) $t['mountain_elevation'],
                'difficulty' => $t['mountain_difficulty'],
                'latitude' => Fmt::float($t['mountain_lat']),
                'longitude' => Fmt::float($t['mountain_lng']),
            ],
            'trailId' => Fmt::int($t['trail_id']),
            'trailName' => $t['trail_name'],
            'groupSize' => (int) $t['group_size'],
            'plannedDays' => (int) $t['planned_days'],
            'startDate' => Fmt::iso($t['start_date']),
            'expectedReturnAt' => Fmt::iso($t['expected_return_at']),
            'contactId' => Fmt::int($t['contact_id']),
            'notes' => $t['notes'] ?? '',
            'status' => $t['status'],
            'startedAt' => Fmt::iso($t['started_at']),
            'endedAt' => Fmt::iso($t['ended_at']),
            'isOverdue' => $t['status'] === 'active' && time() > strtotime($t['expected_return_at']),
            'durationMinutes' => self::durationMinutes($t),
        ];
    }

    public static function formatLocation(array $r): array
    {
        return [
            'latitude' => Fmt::float($r['latitude']),
            'longitude' => Fmt::float($r['longitude']),
            'altitudeM' => Fmt::int($r['altitude_m']),
            'accuracyM' => Fmt::float($r['accuracy_m']),
            'source' => $r['source'],
            'recordedAt' => Fmt::iso($r['recorded_at'] ?? $r['triggered_at'] ?? null),
        ];
    }
}
