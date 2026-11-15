<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database as DB;
use App\Core\Fmt;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\HealthLog;
use App\Models\Trip;
use DateTimeImmutable;

final class HealthController
{
    private const METRICS = ['bpm', 'altitudeM', 'spo2', 'temperatureC', 'steps', 'calories'];

    /** GET /health?tripId=&limit= : data terbaru, riwayat, dan peringatan */
    public function index(Request $r): void
    {
        $f = (new Validator($_GET))->int('tripId', 'Pendakian', false, 1)->int('limit', 'Limit', false, 1, 500)->validate();
        if (isset($f['tripId'])) Trip::findOwned($f['tripId'], $r->userId());
        $items = array_map([HealthLog::class, 'format'], HealthLog::list($r->userId(), $f['tripId'] ?? null, $f['limit'] ?? 50));
        $latest = $items[0] ?? null;
        Response::ok([
            'latest' => $latest,
            'warnings' => $latest['warnings'] ?? [],
            'spo2Low' => $latest['spo2Low'] ?? false,
            'items' => $items,
        ]);
    }

    /** POST /health  body: bpm, altitudeM, spo2, temperatureC, steps, calories, isSimulated?, recordedAt?, tripId? */
    public function store(Request $r): void
    {
        $uid = $r->userId();
        $d = $r->body();
        $f = (new Validator($d))
            ->int('bpm', 'Detak jantung', false, 25, 250)
            ->number('altitudeM', 'Ketinggian', false, -500, 9500)
            ->int('spo2', 'SpO2', false, 50, 100)
            ->number('temperatureC', 'Suhu tubuh', false, 28, 45)
            ->int('steps', 'Langkah', false, 0, 500000)
            ->int('calories', 'Kalori', false, 0, 100000)
            ->bool('isSimulated')
            ->datetime('recordedAt', 'Waktu')
            ->int('tripId', 'Pendakian', false, 1)
            ->validate();
        if (!array_intersect(self::METRICS, array_keys($f))) {
            throw HttpException::validation(['bpm' => 'Isi minimal satu data kesehatan']);
        }
        $tripId = isset($f['tripId'])
            ? (int) Trip::findOwned($f['tripId'], $uid)['id']
            : (($a = Trip::active($uid)) ? (int) $a['id'] : null);
        $low = isset($f['spo2']) && $f['spo2'] < (int) \App\Core\App::config('health.spo2_low', 90);
        $id = DB::insert('health_logs', [
            'user_id' => $uid, 'trip_id' => $tripId,
            'recorded_at' => Fmt::sql($f['recordedAt'] ?? new DateTimeImmutable()),
            'bpm' => $f['bpm'] ?? null,
            'altitude_m' => isset($f['altitudeM']) ? (int) round($f['altitudeM']) : null,
            'spo2' => $f['spo2'] ?? null,
            'temperature_c' => isset($f['temperatureC']) ? round($f['temperatureC'], 1) : null,
            'steps' => $f['steps'] ?? null,
            'calories' => $f['calories'] ?? null,
            'is_simulated' => (int) ($f['isSimulated'] ?? false),
            'spo2_low' => (int) $low,
        ]);
        $h = HealthLog::format(HealthLog::find($id));
        Response::created($h, $low ? 'Data tersimpan. Peringatan: SpO2 rendah!' : 'Data kesehatan tersimpan');
    }
}
