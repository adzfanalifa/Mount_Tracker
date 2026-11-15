<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database as DB;
use App\Core\Fmt;
use App\Core\Request;
use App\Core\Response;
use App\Core\HttpException;
use App\Core\Validator;
use App\Models\Emergency;
use App\Models\Trip;
use DateTimeImmutable;

/** SOS / kondisi darurat. Alias lama /emergencies tetap didukung. */
final class SosController
{
    /** GET /sos */
    public function index(Request $r): void
    {
        Response::ok(array_map([Emergency::class, 'format'], Emergency::list($r->userId())));
    }

    /** POST /sos  body: latitude, longitude, time? (atau recordedAt), type?, message?, tripId?, source? */
    public function store(Request $r): void
    {
        $uid = $r->userId();
        $d = $r->body();
        if (isset($d['location']) && is_array($d['location'])) $d += $d['location'];
        $d['time'] = $d['time'] ?? $d['recordedAt'] ?? $d['triggeredAt'] ?? null;
        $f = (new Validator($d))
            ->enum('type', 'Jenis darurat', Emergency::TYPES)
            ->string('message', 'Pesan', false, 0, 1000)
            ->datetime('time', 'Waktu')
            ->int('tripId', 'Pendakian', false, 1)
            ->validate();
        $tripId = isset($f['tripId'])
            ? (int) Trip::findOwned($f['tripId'], $uid)['id']
            : (($a = Trip::active($uid)) ? (int) $a['id'] : null);

        $loc = TripController::locationFields($d);
        // GPS gagal -> pakai lokasi terakhir yang diketahui dari pendakian.
        if ($loc['source'] === 'unavailable' && $tripId && ($last = Trip::lastKnownLocation($tripId))) {
            $loc = ['latitude' => $last['latitude'], 'longitude' => $last['longitude'], 'altitude_m' => $last['altitude_m'],
                    'accuracy_m' => $last['accuracy_m'], 'source' => $last['source']];
        }
        $at = $f['time'] ?? new DateTimeImmutable();
        $id = DB::insert('emergency_events', $loc + [
            'user_id' => $uid, 'trip_id' => $tripId, 'type' => $f['type'] ?? 'sos', 'message' => $f['message'] ?? '',
            'status' => 'active', 'triggered_at' => Fmt::sql($at),
        ]);
        Response::created(Emergency::format(Emergency::findOwned($id, $uid)), 'SOS tercatat. Segera hubungi kontak darurat atau Basarnas 115.');
    }

    /** POST /sos/{id}/resolve  body: status = resolved | cancelled */
    public function resolve(Request $r): void
    {
        $uid = $r->userId();
        $e = Emergency::findOwned($r->param('id'), $uid);
        $f = (new Validator($r->body()))->enum('status', 'Status', ['resolved', 'cancelled'])->validate();
        if ($e['status'] !== 'active') throw HttpException::conflict('Kondisi darurat ini sudah ditutup');
        DB::update('emergency_events', (int) $e['id'], ['status' => $f['status'] ?? 'resolved', 'resolved_at' => Fmt::now()]);
        Response::ok(Emergency::format(Emergency::findOwned((int) $e['id'], $uid)), 'Status darurat diperbarui');
    }
}
