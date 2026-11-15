<?php
declare(strict_types=1);

/**
 * Tes otomatis semua endpoint Mount Tracker API.
 *
 * Pakai:  php tests/api_test.php [base_url]
 * Contoh: php tests/api_test.php http://127.0.0.1:8000
 *
 * Syarat: database sudah di-import (schema.sql + seed.sql), server berjalan,
 * APP_DEBUG=true di .env (agar kode reset ikut di response), Mailpit berjalan (port 1025).
 * Tes membuat user baru dengan nama acak, jadi aman dijalankan berulang kali.
 */

$BASE = rtrim($argv[1] ?? 'http://127.0.0.1:8000', '/');
$pass = 0;
$fail = 0;
$failures = [];

function req(string $method, string $path, ?array $body = null, ?string $token = null): array
{
    global $BASE;
    $ch = curl_init($BASE . $path);
    $h = ['Accept: application/json'];
    if ($body !== null) $h[] = 'Content-Type: application/json';
    if ($token) $h[] = "Authorization: Bearer $token";
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 30,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body),
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode((string) $raw, true);
    return ['status' => $status, 'json' => $json, 'raw' => $raw, 'data' => $json['data'] ?? null, 'message' => $json['message'] ?? ''];
}

function check(string $name, bool $ok, string $detail = ''): void
{
    global $pass, $fail, $failures;
    if ($ok) { $pass++; echo "  \033[32mOK\033[0m   $name\n"; }
    else { $fail++; $failures[] = $name; echo "  \033[31mGAGAL\033[0m $name" . ($detail ? " -> $detail" : '') . "\n"; }
}

/** Cek status HTTP + format seragam {success, message, data}. */
function expect(string $name, array $r, int $status, ?callable $extra = null): array
{
    $shape = is_array($r['json']) && array_key_exists('success', $r['json']) && array_key_exists('message', $r['json']) && array_key_exists('data', $r['json']);
    $ok = $r['status'] === $status && $shape && $r['json']['success'] === ($status < 400);
    if ($ok && $extra) $ok = (bool) $extra($r['data'], $r);
    check($name, $ok, "status {$r['status']}: " . substr((string) $r['raw'], 0, 220));
    return $r;
}

function section(string $t): void { echo "\n\033[1m== $t ==\033[0m\n"; }

$u = 'tes' . substr(bin2hex(random_bytes(3)), 0, 6);
$email = "$u@contoh.test";
$pw = 'rahasia123';

section('Server');
expect('GET / status server + database', req('GET', '/'), 200, fn($d) => $d['database'] === 'ok');
expect('Endpoint tidak ada -> 404', req('GET', '/tidak-ada'), 404);
expect('Method salah -> 405', req('DELETE', '/login'), 405);
check('CORS preflight -> 204', (function () { global $BASE; $ch = curl_init("$BASE/trips"); curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => 'OPTIONS', CURLOPT_RETURNTRANSFER => true]); curl_exec($ch); $s = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch); return $s === 204; })());

section('1. Auth');
expect('Register email salah -> 422', req('POST', '/register', ['username' => $u, 'email' => 'salah@', 'password' => $pw, 'confirmPassword' => $pw]), 422);
expect('Register konfirmasi beda -> 422', req('POST', '/register', ['username' => $u, 'email' => $email, 'password' => $pw, 'confirmPassword' => 'lain123']), 422);
expect('Register password pendek -> 422', req('POST', '/register', ['username' => $u, 'email' => $email, 'password' => '123']), 422);
$r = expect('Register berhasil -> 201 + token', req('POST', '/register', ['username' => $u, 'email' => $email, 'password' => $pw, 'confirmPassword' => $pw]), 201, fn($d) => !empty($d['token']) && $d['user']['username'] === $u);
expect('Register duplikat -> 409', req('POST', '/register', ['username' => $u, 'email' => "x$email", 'password' => $pw]), 409);
expect('Login dengan username', req('POST', '/login', ['login' => $u, 'password' => $pw]), 200, fn($d) => !empty($d['token']));
$r = expect('Login dengan email', req('POST', '/login', ['login' => strtoupper($email), 'password' => $pw]), 200);
$T = $r['data']['token'] ?? '';
expect('Login password salah -> 401', req('POST', '/login', ['login' => $u, 'password' => 'salah999']), 401);
expect('Login kosong -> 422', req('POST', '/login', []), 422);
expect('GET /me tanpa token -> 401', req('GET', '/me'), 401);
expect('GET /me token palsu -> 401', req('GET', '/me', null, 'abc.def.ghi'), 401);
expect('GET /me', req('GET', '/me', null, $T), 200, fn($d) => $d['email'] === $email);
expect('PUT /me nama tampilan', req('PUT', '/me', ['displayName' => 'Pendaki Uji'], $T), 200, fn($d) => $d['displayName'] === 'Pendaki Uji');
expect('Lupa password email tidak terdaftar -> 200 (tidak bocor)', req('POST', '/forgot', ['email' => 'tidakada@contoh.test']), 200, fn($d) => !isset($d['debugCode']));
$r = expect('Lupa password -> kode terkirim (Mailpit/SMTP)', req('POST', '/forgot', ['username' => $u, 'email' => $email]), 200, fn($d) => isset($d['deliveredVia']));
$code = $r['data']['debugCode'] ?? null;
check('Kode reset tersedia (APP_DEBUG=true)', (bool) $code);
expect('Reset kode salah -> 400', req('POST', '/reset', ['email' => $email, 'code' => $code === '000000' ? '111111' : '000000', 'newPassword' => 'baru12345']), 400);
expect('Reset kode benar', req('POST', '/reset', ['email' => $email, 'code' => (string) $code, 'newPassword' => 'baru12345', 'confirmPassword' => 'baru12345']), 200);
expect('Kode reset tidak bisa dipakai 2x -> 400', req('POST', '/reset', ['email' => $email, 'code' => (string) $code, 'newPassword' => 'baru12345']), 400);
expect('Login password lama ditolak', req('POST', '/login', ['login' => $u, 'password' => $pw]), 401);
$r = expect('Login password baru', req('POST', '/login', ['login' => $u, 'password' => 'baru12345']), 200);
$T = $r['data']['token'] ?? $T;
$g = req('POST', '/auth/google', ['idToken' => str_repeat('x', 40)]);
check('Login Google: 503 jika belum dikonfigurasi / 401 token palsu', in_array($g['status'], [503, 401], true), "status {$g['status']}");

section('2-3. Gunung, jalur, pos');
expect('GET /mountains (4 gunung)', req('GET', '/mountains'), 200, fn($d) => count($d) >= 4);
expect('Search q=rin', req('GET', '/mountains?q=rin'), 200, fn($d) => count($d) === 1 && $d[0]['name'] === 'Rinjani');
expect('Filter difficulty=extreme', req('GET', '/mountains?difficulty=extreme'), 200, fn($d) => count($d) === 1 && $d[0]['name'] === 'Carstensz');
expect('Filter difficulty=easy (Gede & Rinjani)', req('GET', '/mountains?difficulty=easy'), 200, fn($d) => count($d) === 2);
expect('Filter difficulty tidak valid -> 422', req('GET', '/mountains?difficulty=hard'), 422);
expect('Search tidak ada hasil -> []', req('GET', '/mountains?q=zzzz'), 200, fn($d) => $d === []);
$r = expect('Detail gunung 1 + jalur + pos', req('GET', '/mountains/1'), 200, fn($d) => $d['name'] === 'Rinjani' && count($d['trailDetails']) === 2 && str_contains((string) $d['imageUrl'], '/images/rinjani.jpg'));
expect('Detail gunung tidak ada -> 404', req('GET', '/mountains/999'), 404);
$r = expect('Jalur Rinjani + pos', req('GET', '/mountains/1/trails'), 200, function ($d) {
    $s = array_values(array_filter($d, fn($t) => $t['name'] === 'Rinjani via Sembalun'))[0] ?? null;
    return $s && count($s['checkpoints']) === 6 && $s['checkpoints'][0]['name'] === 'Pos 1 Sembalun' && $s['checkpoints'][0]['isSample'] === true;
});
$cps = expect('Pos jalur 1 berurutan', req('GET', '/trails/1/checkpoints'), 200, fn($d) => array_column($d, 'order') === [1, 2, 3, 4, 5, 6]
    && array_column($d, 'elevationMdpl') === [1156, 1800, 2100, 2400, 2639, 3726])['data'];
expect('Detail jalur', req('GET', '/trails/1'), 200, fn($d) => $d['distanceKm'] === 13.5);

section('7. Kontak darurat');
expect('Tambah kontak telepon salah -> 422', req('POST', '/contacts', ['name' => 'Ibu', 'phone' => 'abc'], $T), 422);
$c1 = expect('Tambah kontak pertama (otomatis utama)', req('POST', '/contacts', ['name' => 'Ibu', 'phone' => '0812-3456 7890', 'relationship' => 'Keluarga'], $T), 201, fn($d) => $d['isPrimary'] && $d['phone'] === '081234567890')['data'];
$c2 = expect('Tambah kontak kedua', req('POST', '/contacts', ['name' => 'Teman', 'phone' => '081298765432'], $T), 201, fn($d) => !$d['isPrimary'])['data'];
expect('Ubah kontak', req('PUT', "/contacts/{$c2['id']}", ['relationship' => 'Teman kampus'], $T), 200, fn($d) => $d['relationship'] === 'Teman kampus');
expect('Jadikan kontak utama', req('PUT', "/contacts/{$c2['id']}/primary", [], $T), 200, fn($d) => $d['isPrimary']);
expect('Daftar kontak: tepat 1 utama', req('GET', '/contacts', null, $T), 200, fn($d) => count($d) === 2 && count(array_filter($d, fn($c) => $c['isPrimary'])) === 1 && $d[0]['id'] === $c2['id']);
expect('Hapus kontak utama -> yang lain jadi utama', req('DELETE', "/contacts/{$c2['id']}", null, $T), 200);
expect('Sisa kontak jadi utama', req('GET', '/contacts', null, $T), 200, fn($d) => count($d) === 1 && $d[0]['isPrimary']);
expect('Kontak milik user lain -> 404', req('DELETE', '/contacts/1', null, $T), 404);

section('4. Pendakian');
expect('GET /trips/active belum ada -> null', req('GET', '/trips/active', null, $T), 200, fn($d) => $d === null);
expect('Buat trip tanggal lampau -> 422', req('POST', '/trips', ['mountainId' => 1, 'trailId' => 1, 'startDate' => date('Y-m-d', strtotime('-2 days'))], $T), 422);
expect('Buat trip jalur gunung lain -> 422', req('POST', '/trips', ['mountainId' => 2, 'trailId' => 1, 'startDate' => date('Y-m-d')], $T), 422);
expect('Buat trip tanpa jalur -> 422', req('POST', '/trips', ['mountainId' => 1, 'startDate' => date('Y-m-d')], $T), 422);
$trip = expect('Buat trip Rinjani via Sembalun', req('POST', '/trips', ['mountainId' => 1, 'trailId' => 1, 'groupSize' => 3, 'plannedDays' => 2, 'startDate' => date('c'), 'notes' => 'tes'], $T), 201,
    fn($d) => $d['status'] === 'planned' && $d['contactId'] === $c1['id'] && $d['checkpoints']['total'] === 6)['data'];
$tid = $trip['id'] ?? 0;
expect('Trip aktif = rencana', req('GET', '/trips/active', null, $T), 200, fn($d) => $d['id'] === $tid && $d['status'] === 'planned');
expect('Lokasi sebelum mulai -> 409', req('POST', "/trips/$tid/locations", ['latitude' => -8.37, 'longitude' => 116.52], $T), 409);
expect('Check-in sebelum mulai -> 409', req('POST', "/trips/$tid/checkins", ['checkpointId' => $cps[0]['id']], $T), 409);
expect('Finish sebelum mulai -> 409', req('POST', "/trips/$tid/finish", [], $T), 409);
expect('Mulai pendakian', req('POST', "/trips/$tid/start", [], $T), 200, fn($d) => $d['status'] === 'active' && $d['startedAt'] !== null);
expect('Mulai 2x -> 409', req('POST', "/trips/$tid/start", [], $T), 409);
expect('Trip aktif (status, durasi, estimasi pos 1)', req('GET', '/trips/active', null, $T), 200,
    fn($d) => $d['status'] === 'active' && isset($d['durationMinutes']) && $d['checkpoints']['next']['name'] === 'Pos 1 Sembalun' && $d['checkpoints']['next']['estimatedAt'] !== null);
expect('Simpan 1 lokasi', req('POST', "/trips/$tid/locations", ['latitude' => -8.3725, 'longitude' => 116.529, 'altitudeM' => 1160, 'accuracyM' => 8], $T), 201, fn($d) => $d['saved'] === 1);
expect('Simpan banyak lokasi (termasuk GPS hilang)', req('POST', "/trips/$tid/locations", ['locations' => [
    ['latitude' => -8.375, 'longitude' => 116.525, 'altitudeM' => 1300],
    ['source' => 'unavailable'],
]], $T), 201, fn($d) => $d['saved'] === 2);
expect('Lokasi latitude tidak valid -> 422', req('POST', "/trips/$tid/locations", ['latitude' => 95, 'longitude' => 0], $T), 422);
expect('Trip orang lain -> 404', req('GET', '/trips/999999', null, $T), 404);

section('5. Check-in pos');
expect('Check-in pos jalur lain -> 422', req('POST', "/trips/$tid/checkins", ['checkpointId' => 999999], $T), 422);
expect('Check-in waktu di masa depan -> 422', req('POST', "/trips/$tid/checkins", ['checkpointId' => $cps[0]['id'], 'arrivedAt' => date('c', time() + 3600)], $T), 422);
expect('Check-in Pos 1', req('POST', "/trips/$tid/checkins", ['checkpointId' => $cps[0]['id'], 'latitude' => -8.372, 'longitude' => 116.5225], $T), 201,
    fn($d) => $d['checkedIn'] === 1 && $d['checkpoints'][0]['status'] === 'current' && $d['next']['name'] === 'Pos 2' && $d['next']['estimatedAt'] !== null);
expect('Check-in Pos 1 lagi -> 409', req('POST', "/trips/$tid/checkins", ['checkpointId' => $cps[0]['id']], $T), 409);
expect('Check-in Pos 3 (lewati Pos 2)', req('POST', "/trips/$tid/checkins", ['checkpointId' => $cps[2]['id']], $T), 201,
    fn($d) => $d['checkpoints'][0]['status'] === 'done' && $d['checkpoints'][1]['skipped'] === true && $d['checkpoints'][2]['status'] === 'current' && $d['next']['name'] === 'Pos 4');
expect('Check-in mundur ke Pos 2 -> 409', req('POST', "/trips/$tid/checkins", ['checkpointId' => $cps[1]['id']], $T), 409);
expect('Daftar pos + estimasi berurutan', req('GET', "/trips/$tid/checkpoints", null, $T), 200, function ($d) {
    $eta = array_values(array_filter(array_column($d['checkpoints'], 'estimatedAt')));
    $sorted = $eta; sort($sorted);
    return count($eta) === 3 && $eta === $sorted && $d['paceFactor'] >= 0.5 && $d['paceFactor'] <= 3;
});
expect('Detail trip + jejak lokasi', req('GET', "/trips/$tid", null, $T), 200, fn($d) => count($d['locations']) === 3 && $d['lastKnownLocation']['latitude'] === -8.375);

section('6. Health');
expect('Health tanpa data -> 422', req('POST', '/health', ['isSimulated' => true], $T), 422);
expect('Health SpO2 di luar batas -> 422', req('POST', '/health', ['spo2' => 120], $T), 422);
expect('Simpan health normal', req('POST', '/health', ['bpm' => 110, 'altitudeM' => 2100, 'spo2' => 95, 'temperatureC' => 36.7, 'steps' => 8200, 'calories' => 520, 'isSimulated' => true], $T), 201,
    fn($d) => $d['spo2Low'] === false && $d['warnings'] === [] && $d['tripId'] === $tid && $d['status'] === 'ok');
expect('Simpan health SpO2 rendah -> flag peringatan', req('POST', '/health', ['bpm' => 128, 'altitudeM' => 3500, 'spo2' => 87, 'temperatureC' => 36.4, 'steps' => 15000, 'calories' => 1300], $T), 201,
    fn($d) => $d['spo2Low'] === true && $d['warnings'][0]['code'] === 'spo2_low');
expect('SpO2 kritis', req('POST', '/health', ['spo2' => 82], $T), 201, fn($d) => $d['warnings'][0]['code'] === 'spo2_critical' && $d['status'] === 'danger');
expect('Riwayat health + data terbaru', req('GET', "/health?tripId=$tid", null, $T), 200, fn($d) => count($d['items']) === 3 && $d['latest']['spo2'] === 82 && $d['spo2Low'] === true);

section('7. SOS');
expect('SOS dengan koordinat', req('POST', '/sos', ['latitude' => -8.39, 'longitude' => 116.5, 'time' => date('c'), 'type' => 'injury', 'message' => 'Kaki terkilir'], $T), 201,
    fn($d) => $d['status'] === 'active' && $d['latitude'] === -8.39 && $d['tripId'] === $tid);
$sos = expect('SOS tanpa GPS -> pakai lokasi terakhir', req('POST', '/sos', ['source' => 'unavailable'], $T), 201, fn($d) => $d['location']['latitude'] === -8.375)['data'];
expect('SOS koordinat tidak valid -> 422', req('POST', '/sos', ['latitude' => 'abc', 'longitude' => 1], $T), 422);
expect('Daftar SOS', req('GET', '/sos', null, $T), 200, fn($d) => count($d) === 2);
expect('Tutup SOS', req('POST', "/sos/{$sos['id']}/resolve", ['status' => 'resolved'], $T), 200, fn($d) => $d['status'] === 'resolved');
expect('Tutup SOS 2x -> 409', req('POST', "/sos/{$sos['id']}/resolve", [], $T), 409);
expect('Alias /emergencies', req('GET', '/emergencies', null, $T), 200, fn($d) => count($d) === 2);

section('4. Selesai, batal, riwayat');
expect('Akhiri pendakian', req('POST', "/trips/$tid/finish", [], $T), 200, fn($d) => $d['status'] === 'finished' && $d['endedAt'] !== null);
$t2 = expect('Buat trip kedua', req('POST', '/trips', ['mountainId' => 2, 'trailName' => 'Gede via Cibodas', 'startDate' => date('Y-m-d', strtotime('+3 days'))], $T), 201)['data'];
expect('Batalkan trip kedua', req('POST', "/trips/{$t2['id']}/cancel", [], $T), 200, fn($d) => $d['status'] === 'cancelled');
expect('Batal 2x -> 409', req('POST', "/trips/{$t2['id']}/cancel", [], $T), 409);
expect('Riwayat semua', req('GET', '/trips', null, $T), 200, fn($d) => count($d) === 2);
expect('Riwayat filter finished + lokasi', req('GET', '/trips?status=finished&include=locations', null, $T), 200, fn($d) => count($d) === 1 && count($d[0]['locations']) === 3);
expect('Riwayat status tidak valid -> 422', req('GET', '/trips?status=abc', null, $T), 422);
expect('Tidak ada trip aktif setelah selesai', req('GET', '/trips/active', null, $T), 200, fn($d) => $d === null);

section('8. Cuaca (Open-Meteo)');
expect('Cuaca per jam lat/lng', req('GET', '/weather?lat=-8.41&lng=116.46&hours=6'), 200, fn($d) => count($d['hourly']) === 6 && isset($d['hourly'][0]['temperatureC'], $d['hourly'][0]['description']));
expect('Cuaca per gunung', req('GET', '/weather?mountainId=2'), 200, fn($d) => count($d['hourly']) > 0 && $d['current'] !== null);
expect('Cuaca tanpa koordinat -> 422', req('GET', '/weather'), 422);
expect('Cuaca lat tidak valid -> 422', req('GET', '/weather?lat=100&lng=0'), 422);

section('Laporan kendala & admin');
expect('Tambah laporan', req('POST', '/issues', ['category' => 'Peta', 'description' => 'Peta lambat dimuat'], $T), 201);
expect('Daftar laporan', req('GET', '/issues', null, $T), 200, fn($d) => count($d) === 1);
expect('User biasa tambah gunung -> 403', req('POST', '/mountains', ['name' => 'X', 'elevationMdpl' => 1000], $T), 403);
$a = req('POST', '/login', ['login' => 'admin', 'password' => 'admin1234']);
$A = $a['data']['token'] ?? '';
check('Login admin demo', $a['status'] === 200 && $a['data']['user']['role'] === 'admin');
$m = expect('Admin tambah gunung', req('POST', '/mountains', ['name' => "Uji $u", 'elevationMdpl' => 1500, 'difficulty' => 'medium', 'latitude' => -7, 'longitude' => 110], $A), 201)['data'];
$tr = expect('Admin tambah jalur', req('POST', "/mountains/{$m['id']}/trails", ['name' => 'Jalur Uji', 'basecampElevation' => 800], $A), 201)['data'];
$cp = expect('Admin tambah pos', req('POST', "/trails/{$tr['id']}/checkpoints", ['name' => 'Pos Uji', 'order' => 1, 'elevationMdpl' => 1000, 'distanceKm' => 2, 'latitude' => -7.01, 'longitude' => 110.01], $A), 201)['data'];
expect('Admin ubah pos', req('PUT', "/checkpoints/{$cp['id']}", ['name' => 'Pos Uji 2'], $A), 200, fn($d) => $d['name'] === 'Pos Uji 2');
expect('Admin ubah gunung', req('PUT', "/mountains/{$m['id']}", ['difficulty' => 'extreme'], $A), 200, fn($d) => $d['difficulty'] === 'extreme');
expect('Admin hapus gunung (jalur & pos ikut terhapus)', req('DELETE', "/mountains/{$m['id']}", null, $A), 200);
expect('Gunung terhapus -> 404', req('GET', "/mountains/{$m['id']}"), 404);
expect('Login demo user', req('POST', '/login', ['login' => 'demo', 'password' => 'demo1234']), 200);

echo "\n\033[1mHasil: $pass lulus, $fail gagal\033[0m\n";
if ($failures) { echo "Gagal:\n - " . implode("\n - ", $failures) . "\n"; }
exit($fail ? 1 : 0);
