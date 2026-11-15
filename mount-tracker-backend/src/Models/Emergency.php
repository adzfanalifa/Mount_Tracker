<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;
use App\Core\HttpException;

final class Emergency
{
    public const TYPES = ['sos', 'lost', 'injury', 'weather', 'other'];
    public const SOURCES = ['gps', 'network', 'manual', 'unavailable'];

    public static function list(int $userId): array
    {
        return DB::all('SELECT * FROM emergency_events WHERE user_id=? ORDER BY id DESC', [$userId]);
    }

    public static function findOwned(int $id, int $userId): array
    {
        return DB::one('SELECT * FROM emergency_events WHERE id=? AND user_id=?', [$id, $userId])
            ?? throw HttpException::notFound('Data darurat tidak ditemukan');
    }

    public static function format(array $e): array
    {
        return [
            'id' => (int) $e['id'],
            'type' => $e['type'],
            'message' => $e['message'] ?? '',
            'status' => $e['status'],
            'tripId' => Fmt::int($e['trip_id']),
            'location' => [
                'latitude' => Fmt::float($e['latitude']),
                'longitude' => Fmt::float($e['longitude']),
                'altitudeM' => Fmt::int($e['altitude_m']),
                'accuracyM' => Fmt::float($e['accuracy_m']),
                'source' => $e['source'],
            ],
            'latitude' => Fmt::float($e['latitude']),
            'longitude' => Fmt::float($e['longitude']),
            'triggeredAt' => Fmt::iso($e['triggered_at']),
            'resolvedAt' => Fmt::iso($e['resolved_at']),
        ];
    }
}
