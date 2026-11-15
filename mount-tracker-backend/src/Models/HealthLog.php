<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\App;
use App\Core\Database as DB;
use App\Core\Fmt;

final class HealthLog
{
    public static function list(int $userId, ?int $tripId, int $limit): array
    {
        $sql = 'SELECT * FROM health_logs WHERE user_id=?';
        $p = [$userId];
        if ($tripId) { $sql .= ' AND trip_id=?'; $p[] = $tripId; }
        $sql .= ' ORDER BY recorded_at DESC, id DESC LIMIT ' . max(1, min(500, $limit));
        return DB::all($sql, $p);
    }

    public static function find(int $id): ?array
    {
        return DB::one('SELECT * FROM health_logs WHERE id=?', [$id]);
    }

    /** Daftar peringatan berdasarkan nilai yang tercatat. */
    public static function warnings(array $h): array
    {
        $w = [];
        $low = (int) App::config('health.spo2_low', 90);
        $crit = (int) App::config('health.spo2_critical', 85);
        if ($h['spo2'] !== null) {
            $s = (int) $h['spo2'];
            if ($s < $crit) $w[] = ['code' => 'spo2_critical', 'level' => 'danger', 'message' => "SpO2 $s% sangat rendah. Hentikan pendakian, turun ke ketinggian lebih rendah, dan minta bantuan."];
            elseif ($s < $low) $w[] = ['code' => 'spo2_low', 'level' => 'warning', 'message' => "Kadar oksigen menurun ($s%), istirahat sejenak."];
        }
        if ($h['bpm'] !== null && (int) $h['bpm'] >= 170) $w[] = ['code' => 'bpm_high', 'level' => 'warning', 'message' => 'Detak jantung sangat tinggi, kurangi kecepatan.'];
        if ($h['temperature_c'] !== null && (float) $h['temperature_c'] < 35.0) $w[] = ['code' => 'hypothermia', 'level' => 'danger', 'message' => 'Suhu tubuh rendah, waspada hipotermia.'];
        if ($h['temperature_c'] !== null && (float) $h['temperature_c'] >= 38.0) $w[] = ['code' => 'fever', 'level' => 'warning', 'message' => 'Suhu tubuh tinggi, istirahat dan minum air.'];
        return $w;
    }

    public static function format(array $h): array
    {
        $warn = self::warnings($h);
        return [
            'id' => (int) $h['id'],
            'tripId' => Fmt::int($h['trip_id']),
            'recordedAt' => Fmt::iso($h['recorded_at']),
            'bpm' => Fmt::int($h['bpm']),
            'altitudeM' => Fmt::int($h['altitude_m']),
            'spo2' => Fmt::int($h['spo2']),
            'temperatureC' => Fmt::float($h['temperature_c']),
            'steps' => Fmt::int($h['steps']),
            'calories' => Fmt::int($h['calories']),
            'isSimulated' => (bool) $h['is_simulated'],
            'spo2Low' => (bool) $h['spo2_low'],
            'warnings' => $warn,
            'status' => $warn ? ($warn[0]['level'] === 'danger' ? 'danger' : 'warning') : 'ok',
        ];
    }
}
