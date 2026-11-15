<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database as DB;
use App\Core\Fmt;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Checkin;
use App\Models\Contact;
use App\Models\Emergency;
use App\Models\Mountain;
use App\Models\Trail;
use App\Models\Trip;
use DateTimeImmutable;

final class TripController
{
    /** Trip + daftar pos (status & estimasi). */
    private function detail(array $t, bool $withLocations = false): array
    {
        $o = Trip::format($t);
        $o['checkpoints'] = Checkin::progress($t);
        $last = Trip::lastKnownLocation((int) $t['id']);
        $o['lastKnownLocation'] = $last ? Trip::formatLocation($last) : null;
        if ($withLocations) $o['locations'] = array_map([Trip::class, 'formatLocation'], Trip::locations((int) $t['id']));
        return $o;
    }

    /** GET /trips?status= (riwayat) */
    public function index(Request $r): void
    {
        $f = (new Validator($_GET))->enum('status', 'Status', Trip::STATUS)->validate();
        Response::ok(array_map([Trip::class, 'format'], Trip::list($r->userId(), $f['status'] ?? null)));
    }

    /** GET /trips/active : pendakian aktif, atau rencana terdekat; null jika tidak ada. */
    public function active(Request $r): void
    {
        $t = Trip::current($r->userId());
        Response::ok($t ? $this->detail($t) : null, $t ? 'Pendakian ditemukan' : 'Belum ada pendakian aktif');
    }

    /** POST /trips */
    public function store(Request $r): void
    {
        $uid = $r->userId();
        $d = $r->body();
        $f = (new Validator($d))
            ->int('mountainId', 'Gunung', true, 1)
            ->int('trailId', 'Jalur', false, 1)
            ->string('trailName', 'Jalur', false, 1, 150)
            ->int('groupSize', 'Jumlah orang', false, 1, 50)
            ->int('plannedDays', 'Lama pendakian', false, 1, 14)
            ->datetime('startDate', 'Tanggal berangkat', true)
            ->datetime('expectedReturnAt', 'Estimasi turun')
            ->int('contactId', 'Kontak darurat', false, 1)
            ->string('notes', 'Catatan', false, 0, 1000)
            ->validate();

        $m = Mountain::find($f['mountainId']) ?? throw HttpException::notFound('Gunung tidak ditemukan');
        if (isset($f['trailId'])) {
            $trail = Trail::find($f['trailId']);
            if (!$trail || (int) $trail['mountain_id'] !== (int) $m['id']) throw HttpException::validation(['trailId' => 'Jalur tidak ada di gunung ini']);
        } elseif (isset($f['trailName'])) {
            $trail = Trail::findByName((int) $m['id'], $f['trailName']) ?? throw HttpException::validation(['trailName' => 'Jalur tidak ada di gunung ini']);
        } else {
            throw HttpException::validation(['trailId' => 'Jalur wajib dipilih']);
        }

        $days = $f['plannedDays'] ?? 1;
        $start = $f['startDate'];
        $startDay = $start->setTime(0, 0);
        if ($startDay < new DateTimeImmutable('today')) throw HttpException::validation(['startDate' => 'Tanggal berangkat tidak boleh di masa lalu']);
        $ret = $f['expectedReturnAt'] ?? $startDay->modify('+' . ($days - 1) . ' days')->setTime(18, 0);
        if ($ret <= $startDay) throw HttpException::validation(['expectedReturnAt' => 'Estimasi turun harus setelah tanggal berangkat']);

        $contactId = isset($f['contactId'])
            ? (int) Contact::findOwned($f['contactId'], $uid)['id']
            : (($p = Contact::primary($uid)) ? (int) $p['id'] : null);

        $id = DB::insert('trips', [
            'user_id' => $uid, 'mountain_id' => (int) $m['id'], 'trail_id' => (int) $trail['id'], 'trail_name' => $trail['name'],
            'group_size' => $f['groupSize'] ?? 1, 'planned_days' => $days,
            'start_date' => Fmt::sql($start), 'expected_return_at' => Fmt::sql($ret), 'contact_id' => $contactId,
            'notes' => $f['notes'] ?? '', 'status' => 'planned', 'created_at' => Fmt::now(),
        ]);
        Response::created($this->detail(Trip::findOwned($id, $uid)), 'Rencana pendakian tersimpan');
    }

    /** GET /trips/{id} */
    public function show(Request $r): void
    {
        Response::ok($this->detail(Trip::findOwned($r->param('id'), $r->userId()), true));
    }

    /** POST /trips/{id}/start */
    public function start(Request $r): void
    {
        $uid = $r->userId();
        $t = Trip::findOwned($r->param('id'), $uid);
        if ($t['status'] !== 'planned') throw HttpException::conflict('Hanya pendakian berstatus direncanakan yang bisa dimulai');
        if (Trip::active($uid)) throw HttpException::conflict('Masih ada pendakian aktif. Akhiri dulu sebelum memulai yang baru.');
        DB::update('trips', (int) $t['id'], ['status' => 'active', 'started_at' => Fmt::now()]);
        Response::ok($this->detail(Trip::findOwned((int) $t['id'], $uid)), 'Pendakian dimulai');
    }

    /** POST /trips/{id}/finish */
    public function finish(Request $r): void
    {
        $uid = $r->userId();
        $t = Trip::findOwned($r->param('id'), $uid);
        if ($t['status'] !== 'active') throw HttpException::conflict('Hanya pendakian aktif yang bisa diakhiri');
        DB::update('trips', (int) $t['id'], ['status' => 'finished', 'ended_at' => Fmt::now()]);
        Response::ok($this->detail(Trip::findOwned((int) $t['id'], $uid)), 'Pendakian selesai');
    }

    /** POST /trips/{id}/cancel */
    public function cancel(Request $r): void
    {
        $uid = $r->userId();
        $t = Trip::findOwned($r->param('id'), $uid);
        if (!in_array($t['status'], ['planned', 'active'], true)) throw HttpException::conflict('Pendakian ini sudah selesai atau dibatalkan');
        DB::update('trips', (int) $t['id'], ['status' => 'cancelled', 'ended_at' => Fmt::now()]);
        Response::ok($this->detail(Trip::findOwned((int) $t['id'], $uid)), 'Pendakian dibatalkan');
    }

    /** Validasi satu titik lokasi -> kolom DB. */
    public static function locationFields(array $d, string $prefix = ''): array
    {
        $f = (new Validator($d))
            ->enum('source', 'Sumber lokasi', Emergency::SOURCES)
            ->number('latitude', 'Latitude', false, -90, 90)
            ->number('longitude', 'Longitude', false, -180, 180)
            ->number('altitudeM', 'Ketinggian', false, -500, 9500)
            ->number('accuracyM', 'Akurasi', false, 0, 100000)
            ->validate();
        $src = $f['source'] ?? 'gps';
        if ($src === 'unavailable') return ['latitude' => null, 'longitude' => null, 'altitude_m' => null, 'accuracy_m' => null, 'source' => $src];
        if (!isset($f['latitude'], $f['longitude'])) {
            throw HttpException::validation([$prefix . 'latitude' => 'Latitude dan longitude wajib diisi (atau source = unavailable)']);
        }
        return [
            'latitude' => $f['latitude'], 'longitude' => $f['longitude'],
            'altitude_m' => isset($f['altitudeM']) ? (int) round($f['altitudeM']) : null,
            'accuracy_m' => $f['accuracyM'] ?? null, 'source' => $src,
        ];
    }

    /** POST /trips/{id}/locations  satu titik, atau {"locations":[...]} maksimal 200 */
    public function addLocations(Request $r): void
    {
        $t = Trip::findOwned($r->param('id'), $r->userId());
        if ($t['status'] !== 'active') throw HttpException::conflict('Lokasi hanya dicatat saat pendakian aktif');
        $d = $r->body();
        $items = isset($d['locations']) && is_array($d['locations']) ? $d['locations'] : [$d];
        if (!$items || count($items) > 200) throw HttpException::validation(['locations' => 'Kirim 1-200 lokasi per request']);
        $rows = [];
        foreach ($items as $i => $it) {
            if (!is_array($it)) throw HttpException::validation(["locations.$i" => 'Data lokasi tidak valid']);
            $f = self::locationFields($it, "locations.$i.");
            $f['trip_id'] = (int) $t['id'];
            $f['recorded_at'] = Fmt::sql(Validator::parseDate($it['recordedAt'] ?? null) ?? new DateTimeImmutable());
            $rows[] = $f;
        }
        DB::transaction(function () use ($rows) { foreach ($rows as $f) DB::insert('trip_locations', $f); });
        Response::created(['saved' => count($rows)], count($rows) . ' lokasi tersimpan');
    }

    /** GET /trips/{id}/checkpoints : daftar pos + status + estimasi */
    public function checkpoints(Request $r): void
    {
        Response::ok(Checkin::progress(Trip::findOwned($r->param('id'), $r->userId())));
    }

    /** POST /trips/{id}/checkins  body: checkpointId, arrivedAt?, latitude?, longitude? */
    public function checkin(Request $r): void
    {
        $uid = $r->userId();
        $t = Trip::findOwned($r->param('id'), $uid);
        if ($t['status'] !== 'active') throw HttpException::conflict('Check-in hanya bisa saat pendakian aktif. Mulai pendakian dulu.');
        $f = (new Validator($r->body()))
            ->int('checkpointId', 'Pos', true, 1)
            ->datetime('arrivedAt', 'Waktu sampai')
            ->number('latitude', 'Latitude', false, -90, 90)
            ->number('longitude', 'Longitude', false, -180, 180)
            ->validate();

        $cp = Trail::findCheckpoint($f['checkpointId']);
        $trailId = Checkin::trailIdFor($t);
        if (!$cp || (int) $cp['trail_id'] !== $trailId) throw HttpException::validation(['checkpointId' => 'Pos tidak ada di jalur pendakian ini']);
        if (DB::value('SELECT 1 FROM trip_checkins WHERE trip_id=? AND checkpoint_id=?', [$t['id'], $cp['id']])) {
            throw HttpException::conflict('Sudah check-in di pos ini');
        }
        $lastSeq = (int) DB::value('SELECT COALESCE(MAX(c.seq),0) FROM trip_checkins k JOIN checkpoints c ON c.id=k.checkpoint_id WHERE k.trip_id=?', [$t['id']]);
        if ((int) $cp['seq'] < $lastSeq) throw HttpException::conflict('Pos ini berada sebelum pos terakhir yang sudah dicatat');

        $at = $f['arrivedAt'] ?? new DateTimeImmutable();
        if ($at->getTimestamp() > time() + 300) throw HttpException::validation(['arrivedAt' => 'Waktu sampai tidak boleh di masa depan']);
        if ($at->getTimestamp() < strtotime($t['started_at'])) throw HttpException::validation(['arrivedAt' => 'Waktu sampai tidak boleh sebelum pendakian dimulai']);

        DB::insert('trip_checkins', [
            'trip_id' => (int) $t['id'], 'checkpoint_id' => (int) $cp['id'], 'arrived_at' => Fmt::sql($at),
            'latitude' => $f['latitude'] ?? null, 'longitude' => $f['longitude'] ?? null, 'created_at' => Fmt::now(),
        ]);
        $progress = Checkin::progress(Trip::findOwned((int) $t['id'], $uid));
        Response::created($progress, "Check-in di {$cp['name']} tercatat");
    }
}
