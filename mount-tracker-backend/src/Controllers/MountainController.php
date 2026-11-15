<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database as DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Mountain;
use App\Models\Trail;

final class MountainController
{
    private function mountainOr404(int $id): array
    {
        return Mountain::find($id) ?? throw HttpException::notFound('Gunung tidak ditemukan');
    }

    private function trailOr404(int $id): array
    {
        return Trail::find($id) ?? throw HttpException::notFound('Jalur tidak ditemukan');
    }

    /** Jalur sebuah gunung, lengkap dengan pos. */
    private function trailsWithCheckpoints(int $mountainId): array
    {
        $trails = Trail::forMountains([$mountainId])[$mountainId] ?? [];
        foreach ($trails as &$t) $t['checkpoints'] = Trail::checkpoints((int) $t['id']);
        return $trails;
    }

    /** GET /mountains?q=&difficulty= */
    public function index(Request $r): void
    {
        $f = (new Validator($_GET))
            ->string('q', 'Kata kunci', false, 0, 100)
            ->enum('difficulty', 'Tingkat kesulitan', Mountain::DIFFICULTY)
            ->validate();
        $rows = Mountain::search($f['q'] ?? null, $f['difficulty'] ?? null);
        $trails = Trail::forMountains(array_map(fn($m) => (int) $m['id'], $rows));
        $base = $r->baseUrl();
        Response::ok(array_map(fn($m) => Mountain::format($m, $trails[(int) $m['id']] ?? [], $base), $rows),
            count($rows) . ' gunung ditemukan');
    }

    /** GET /mountains/{id} (jalur + pos) */
    public function show(Request $r): void
    {
        $m = $this->mountainOr404($r->param('id'));
        Response::ok(Mountain::format($m, $this->trailsWithCheckpoints((int) $m['id']), $r->baseUrl()));
    }

    /** GET /mountains/{id}/trails */
    public function trails(Request $r): void
    {
        $m = $this->mountainOr404($r->param('id'));
        Response::ok(array_map(fn($t) => Trail::format($t, $t['checkpoints']), $this->trailsWithCheckpoints((int) $m['id'])));
    }

    /** GET /trails/{id} */
    public function trail(Request $r): void
    {
        $t = $this->trailOr404($r->param('id'));
        Response::ok(Trail::format($t, Trail::checkpoints((int) $t['id'])));
    }

    /** GET /trails/{id}/checkpoints */
    public function checkpoints(Request $r): void
    {
        $t = $this->trailOr404($r->param('id'));
        Response::ok(array_map([Trail::class, 'formatCheckpoint'], Trail::checkpoints((int) $t['id'])));
    }

    // ------------------------------------------------------------ admin

    private function mountainFields(array $d, bool $create): array
    {
        $f = (new Validator($d))
            ->string('name', 'Nama gunung', $create, 2, 120)
            ->int('elevationMdpl', 'Ketinggian', $create, 1, 9000)
            ->enum('difficulty', 'Tingkat kesulitan', Mountain::DIFFICULTY)
            ->string('province', 'Provinsi', false, 0, 100)
            ->string('description', 'Deskripsi', false, 0, 5000)
            ->string('imageUrl', 'URL gambar', false, 0, 255)
            ->number('latitude', 'Latitude', false, -90, 90)
            ->number('longitude', 'Longitude', false, -180, 180)
            ->validate();
        $map = ['name' => 'name', 'elevationMdpl' => 'elevation_mdpl', 'difficulty' => 'difficulty', 'province' => 'province',
                'description' => 'description', 'imageUrl' => 'image_url', 'latitude' => 'latitude', 'longitude' => 'longitude'];
        $out = [];
        foreach ($map as $k => $col) if (array_key_exists($k, $f)) $out[$col] = $f[$k];
        if (!$out) throw new HttpException('Tidak ada data untuk disimpan', 422);
        return $out;
    }

    public function store(Request $r): void
    {
        $id = DB::insert('mountains', $this->mountainFields($r->body(), true));
        Response::created(Mountain::format(Mountain::find($id), [], $r->baseUrl()), 'Gunung ditambahkan');
    }

    public function update(Request $r): void
    {
        $m = $this->mountainOr404($r->param('id'));
        DB::update('mountains', (int) $m['id'], $this->mountainFields($r->body(), false));
        Response::ok(Mountain::format(Mountain::find((int) $m['id']), $this->trailsWithCheckpoints((int) $m['id']), $r->baseUrl()), 'Gunung diperbarui');
    }

    public function destroy(Request $r): void
    {
        $m = $this->mountainOr404($r->param('id'));
        if (DB::value('SELECT 1 FROM trips WHERE mountain_id=? LIMIT 1', [$m['id']])) {
            throw HttpException::conflict('Gunung sudah dipakai di data pendakian, tidak bisa dihapus');
        }
        DB::run('DELETE FROM mountains WHERE id=?', [$m['id']]);
        Response::ok(null, 'Gunung dihapus');
    }

    private function trailFields(array $d, bool $create): array
    {
        $f = (new Validator($d))
            ->string('name', 'Nama jalur', $create, 2, 150)
            ->string('basecampName', 'Nama basecamp', false, 0, 120)
            ->number('basecampLat', 'Latitude basecamp', false, -90, 90)
            ->number('basecampLng', 'Longitude basecamp', false, -180, 180)
            ->int('basecampElevation', 'Ketinggian basecamp', false, 0, 9000)
            ->number('distanceKm', 'Jarak', false, 0, 200)
            ->number('estHours', 'Estimasi jam', false, 0, 200)
            ->validate();
        $map = ['name' => 'name', 'basecampName' => 'basecamp_name', 'basecampLat' => 'basecamp_lat', 'basecampLng' => 'basecamp_lng',
                'basecampElevation' => 'basecamp_elevation', 'distanceKm' => 'distance_km', 'estHours' => 'est_hours'];
        $out = [];
        foreach ($map as $k => $col) if (array_key_exists($k, $f)) $out[$col] = $f[$k];
        if (!$out) throw new HttpException('Tidak ada data untuk disimpan', 422);
        return $out;
    }

    public function storeTrail(Request $r): void
    {
        $m = $this->mountainOr404($r->param('id'));
        $f = $this->trailFields($r->body(), true) + ['mountain_id' => (int) $m['id']];
        Response::created(Trail::format(Trail::find(DB::insert('trails', $f)), []), 'Jalur ditambahkan');
    }

    public function updateTrail(Request $r): void
    {
        $t = $this->trailOr404($r->param('id'));
        DB::update('trails', (int) $t['id'], $this->trailFields($r->body(), false));
        Response::ok(Trail::format(Trail::find((int) $t['id']), Trail::checkpoints((int) $t['id'])), 'Jalur diperbarui');
    }

    public function destroyTrail(Request $r): void
    {
        $t = $this->trailOr404($r->param('id'));
        DB::run('DELETE FROM trails WHERE id=?', [$t['id']]);
        Response::ok(null, 'Jalur dihapus');
    }

    private function checkpointFields(array $d, bool $create): array
    {
        $f = (new Validator($d))
            ->string('name', 'Nama pos', $create, 1, 120)
            ->int('order', 'Urutan', $create, 1, 999)
            ->int('elevationMdpl', 'Ketinggian', $create, 0, 9000)
            ->number('distanceKm', 'Jarak', false, 0, 200)
            ->number('latitude', 'Latitude', $create, -90, 90)
            ->number('longitude', 'Longitude', $create, -180, 180)
            ->bool('isSample')
            ->validate();
        $map = ['name' => 'name', 'order' => 'seq', 'elevationMdpl' => 'elevation_mdpl', 'distanceKm' => 'distance_km',
                'latitude' => 'latitude', 'longitude' => 'longitude', 'isSample' => 'is_sample'];
        $out = [];
        foreach ($map as $k => $col) if (array_key_exists($k, $f)) $out[$col] = is_bool($f[$k]) ? (int) $f[$k] : $f[$k];
        if (!$out) throw new HttpException('Tidak ada data untuk disimpan', 422);
        return $out;
    }

    public function storeCheckpoint(Request $r): void
    {
        $t = $this->trailOr404($r->param('id'));
        $f = $this->checkpointFields($r->body(), true) + ['trail_id' => (int) $t['id']];
        Response::created(Trail::formatCheckpoint(Trail::findCheckpoint(DB::insert('checkpoints', $f))), 'Pos ditambahkan');
    }

    public function updateCheckpoint(Request $r): void
    {
        $c = Trail::findCheckpoint($r->param('id')) ?? throw HttpException::notFound('Pos tidak ditemukan');
        DB::update('checkpoints', (int) $c['id'], $this->checkpointFields($r->body(), false));
        Response::ok(Trail::formatCheckpoint(Trail::findCheckpoint((int) $c['id'])), 'Pos diperbarui');
    }

    public function destroyCheckpoint(Request $r): void
    {
        $c = Trail::findCheckpoint($r->param('id')) ?? throw HttpException::notFound('Pos tidak ditemukan');
        DB::run('DELETE FROM checkpoints WHERE id=?', [$c['id']]);
        Response::ok(null, 'Pos dihapus');
    }
}
