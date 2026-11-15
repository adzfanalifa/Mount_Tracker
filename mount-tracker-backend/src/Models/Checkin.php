<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database as DB;
use App\Core\Fmt;

/**
 * Check-in pos dan estimasi waktu sampai.
 *
 * Estimasi memakai rumus Naismith (4 km/jam + 1 jam per 600 m naik), lalu
 * dikoreksi dengan "faktor kecepatan" rombongan: waktu nyata / waktu Naismith
 * dari mulai pendakian sampai check-in terakhir (dibatasi 0,5x - 3x).
 */
final class Checkin
{
    public static function forTrip(int $tripId): array
    {
        return DB::all('SELECT * FROM trip_checkins WHERE trip_id=? ORDER BY arrived_at, id', [$tripId]);
    }

    /** Menit tempuh perkiraan dari titik a ke b (masing-masing punya km & mdpl). */
    public static function naismithMinutes(?float $km1, ?float $km2, ?int $el1, ?int $el2): float
    {
        $dist = ($km1 !== null && $km2 !== null) ? max(0.0, $km2 - $km1) : 0.0;
        $up = ($el1 !== null && $el2 !== null) ? max(0, $el2 - $el1) : 0;
        $min = $dist / 4 * 60 + $up / 600 * 60;
        return max($min, 10.0); // minimal 10 menit antar pos
    }

    public static function trailIdFor(array $trip): ?int
    {
        if ($trip['trail_id']) return (int) $trip['trail_id'];
        $t = Trail::findByName((int) $trip['mountain_id'], (string) $trip['trail_name']);
        return $t ? (int) $t['id'] : null;
    }

    /** Daftar pos dengan status (done | current | next), jam sampai, dan estimasi. */
    public static function progress(array $trip): array
    {
        $trailId = self::trailIdFor($trip);
        $trail = $trailId ? Trail::find($trailId) : null;
        $cps = $trailId ? Trail::checkpoints($trailId) : [];
        $arrived = [];
        foreach (self::forTrip((int) $trip['id']) as $c) $arrived[(int) $c['checkpoint_id']] = $c['arrived_at'];

        // Indeks pos terakhir yang sudah check-in.
        $last = -1;
        foreach ($cps as $i => $c) if (isset($arrived[(int) $c['id']])) $last = $i;

        // Titik awal: basecamp jalur.
        $startKm = 0.0;
        $startEl = $trail && $trail['basecamp_elevation'] !== null ? (int) $trail['basecamp_elevation'] : ($cps ? (int) $cps[0]['elevation_mdpl'] : null);

        // Waktu Naismith kumulatif dari basecamp ke tiap pos.
        $cum = [];
        $acc = 0.0;
        $prevKm = $startKm;
        $prevEl = $startEl;
        foreach ($cps as $i => $c) {
            $km = $c['distance_km'] !== null ? (float) $c['distance_km'] : null;
            $acc += self::naismithMinutes($prevKm, $km, $prevEl, (int) $c['elevation_mdpl']);
            $cum[$i] = $acc;
            if ($km !== null) $prevKm = $km;
            $prevEl = (int) $c['elevation_mdpl'];
        }

        // Faktor kecepatan rombongan.
        $factor = 1.0;
        $startedTs = $trip['started_at'] ? strtotime($trip['started_at']) : null;
        if ($startedTs && $last >= 0 && $cum[$last] > 0) {
            $actual = (strtotime($arrived[(int) $cps[$last]['id']]) - $startedTs) / 60;
            if ($actual > 0) $factor = min(3.0, max(0.5, $actual / $cum[$last]));
        }

        $baseTs = $last >= 0 ? strtotime($arrived[(int) $cps[$last]['id']]) : $startedTs;
        $baseCum = $last >= 0 ? $cum[$last] : 0.0;
        $isActive = $trip['status'] === 'active';
        $finished = $trip['status'] === 'finished';

        $out = [];
        $next = null;
        foreach ($cps as $i => $c) {
            $id = (int) $c['id'];
            $status = $i < $last ? 'done' : ($i === $last ? ($finished || $i === count($cps) - 1 ? 'done' : 'current') : 'next');
            $eta = null;
            $etaMin = null;
            if ($i > $last && $isActive && $baseTs) {
                $etaMin = (int) round(($cum[$i] - $baseCum) * $factor);
                $eta = date('c', $baseTs + $etaMin * 60);
            }
            $row = Trail::formatCheckpoint($c) + [
                'status' => $status,
                'arrivedAt' => isset($arrived[$id]) ? Fmt::iso($arrived[$id]) : null,
                'skipped' => $i < $last && !isset($arrived[$id]),
                'estimatedAt' => $eta,
                'estimatedMinutesFromLast' => $etaMin,
                'naismithMinutesFromStart' => (int) round($cum[$i]),
            ];
            if ($next === null && $i > $last) $next = $row;
            $out[] = $row;
        }

        return [
            'tripId' => (int) $trip['id'],
            'trailId' => $trailId,
            'paceFactor' => round($factor, 2),
            'checkedIn' => count($arrived),
            'total' => count($cps),
            'next' => $next,
            'checkpoints' => $out,
        ];
    }
}
