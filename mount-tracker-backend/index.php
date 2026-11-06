<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
date_default_timezone_set($config['timezone']);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $config['allowed_origin']);
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

const DIFFICULTY = ['easy', 'medium', 'extreme'];
const LOC_SOURCES = ['gps', 'network', 'manual', 'unavailable'];

/* ================= helper dasar ================= */
function out($data, int $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400) { out(['error' => $msg], $code); }
function body(): array {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}
function db(): PDO {
    static $pdo = null;
    global $config;
    if (!$pdo) {
        $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}
set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage());
    if ($e instanceof PDOException && (string) $e->getCode() === '23000')
        out(['error' => 'Data duplikat atau relasi tidak valid'], 409);
    out(['error' => 'Terjadi kesalahan server'], 500);
});

/* ================= JWT (HS256) ================= */
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64d(string $s): string { return base64_decode(strtr($s, '-_', '+/')); }
function jwt_make(array $p): string {
    global $config;
    $h = b64u(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $p['exp'] = time() + $config['jwt_ttl'];
    $b = b64u(json_encode($p));
    return "$h.$b." . b64u(hash_hmac('sha256', "$h.$b", $config['jwt_secret'], true));
}
function jwt_read(string $t): ?array {
    global $config;
    $x = explode('.', $t);
    if (count($x) !== 3) return null;
    [$h, $b, $s] = $x;
    if (!hash_equals(b64u(hash_hmac('sha256', "$h.$b", $config['jwt_secret'], true)), $s)) return null;
    $p = json_decode(b64d($b), true);
    return (is_array($p) && ($p['exp'] ?? 0) >= time()) ? $p : null;
}
function auth(bool $admin = false): array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+(.+)$/i', $h, $m)) fail('Token diperlukan', 401);
    $p = jwt_read($m[1]);
    if (!$p) fail('Token tidak valid atau kadaluarsa', 401);
    if ($admin && ($p['role'] ?? '') !== 'admin') fail('Khusus admin', 403);
    return $p;
}
function uid(): int { return (int) auth()['sub']; }

/* ================= helper DB ================= */
function insert_row(string $t, array $f): int {
    $cols = implode(',', array_keys($f));
    $ph = implode(',', array_map(fn($k) => ":$k", array_keys($f)));
    db()->prepare("INSERT INTO $t ($cols) VALUES ($ph)")->execute($f);
    return (int) db()->lastInsertId();
}
function update_row(string $t, int $id, array $f): void {
    if (!$f) fail('Tidak ada field untuk diupdate');
    $set = implode(',', array_map(fn($k) => "$k=:$k", array_keys($f)));
    $f['id'] = $id;
    db()->prepare("UPDATE $t SET $set WHERE id=:id")->execute($f);
}
function find_row(string $t, int $id): array {
    $st = db()->prepare("SELECT * FROM $t WHERE id=?");
    $st->execute([$id]);
    return $st->fetch() ?: fail('Data tidak ditemukan', 404);
}
function own_row(string $t, int $id, int $uid): array {
    $st = db()->prepare("SELECT * FROM $t WHERE id=? AND user_id=?");
    $st->execute([$id, $uid]);
    return $st->fetch() ?: fail('Data tidak ditemukan', 404);
}
function own_trip(int $id, int $uid): array {
    $st = db()->prepare('SELECT t.*, m.name AS mountain_name FROM trips t JOIN mountains m ON m.id=t.mountain_id WHERE t.id=? AND t.user_id=?');
    $st->execute([$id, $uid]);
    return $st->fetch() ?: fail('Data tidak ditemukan', 404);
}

/* ================= validasi & format ================= */
function int_in($v, int $min, ?int $max, string $msg): int {
    $i = filter_var($v, FILTER_VALIDATE_INT);
    if ($i === false || $i < $min || ($max !== null && $i > $max)) fail($msg);
    return $i;
}
function parse_dt($v): ?DateTimeImmutable {
    if (!is_string($v) || trim($v) === '') return null;
    try { return (new DateTimeImmutable($v))->setTimezone(new DateTimeZone(date_default_timezone_get())); }
    catch (Throwable $e) { return null; }
}
function sql_dt(DateTimeImmutable $d): string { return $d->format('Y-m-d H:i:s'); }
function iso(?string $s): ?string { return $s ? (new DateTimeImmutable($s))->format('c') : null; }
function fl($v): ?float { return $v === null ? null : (float) $v; }

function loc_fields(array $d): array {
    $src = $d['source'] ?? 'gps';
    if (!in_array($src, LOC_SOURCES, true)) fail('source harus gps, network, manual, atau unavailable');
    $f = ['latitude' => null, 'longitude' => null, 'altitude_m' => null, 'accuracy_m' => null, 'source' => $src];
    if ($src === 'unavailable') return $f;
    $lat = $d['latitude'] ?? null; $lng = $d['longitude'] ?? null;
    if (!is_numeric($lat) || abs((float) $lat) > 90) fail('Latitude tidak valid');
    if (!is_numeric($lng) || abs((float) $lng) > 180) fail('Longitude tidak valid');
    $f['latitude'] = (float) $lat;
    $f['longitude'] = (float) $lng;
    if (isset($d['altitudeM']) && is_numeric($d['altitudeM'])) $f['altitude_m'] = (int) round((float) $d['altitudeM']);
    if (isset($d['accuracyM']) && is_numeric($d['accuracyM'])) $f['accuracy_m'] = (float) $d['accuracyM'];
    return $f;
}
function fmt_loc(array $r, ?string $timeKey = null): array {
    $o = [
        'latitude' => fl($r['latitude']), 'longitude' => fl($r['longitude']),
        'altitudeM' => $r['altitude_m'] === null ? null : (int) $r['altitude_m'],
        'accuracyM' => fl($r['accuracy_m']), 'source' => $r['source'],
    ];
    if ($timeKey) $o['recordedAt'] = iso($r[$timeKey]);
    return $o;
}
function fmt_user(array $u): array {
    return ['id' => (int) $u['id'], 'username' => $u['username'], 'email' => $u['email'], 'role' => $u['role']];
}
function fmt_contact(array $c): array {
    return ['id' => (int) $c['id'], 'name' => $c['name'], 'phone' => $c['phone'],
            'relationship' => $c['relationship'], 'isPrimary' => (bool) $c['is_primary']];
}
function fmt_trail(array $t): array {
    return ['id' => (int) $t['id'], 'name' => $t['name'], 'basecampName' => $t['basecamp_name'],
            'basecampLat' => fl($t['basecamp_lat']), 'basecampLng' => fl($t['basecamp_lng']),
            'distanceKm' => fl($t['distance_km']), 'estHours' => fl($t['est_hours'])];
}
function img_url(?string $v): ?string {
    if (!$v) return null;
    if (preg_match('#^https?://#i', $v)) return $v;
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/images/' . rawurlencode($v);
}
function trails_for(array $ids): array {
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare("SELECT * FROM trails WHERE mountain_id IN ($in) ORDER BY name");
    $st->execute($ids);
    $g = [];
    foreach ($st->fetchAll() as $r) $g[(int) $r['mountain_id']][] = $r;
    return $g;
}
// 'trails' = daftar nama (sama seperti data.js di frontend), 'trailDetails' = info lengkap
function fmt_mountain(array $m, array $trailRows): array {
    return ['id' => (int) $m['id'], 'name' => $m['name'], 'elevationMdpl' => (int) $m['elevation_mdpl'],
            'difficulty' => $m['difficulty'], 'province' => $m['province'],
            'latitude' => fl($m['latitude']), 'longitude' => fl($m['longitude']), 'description' => $m['description'],
            'imageUrl' => img_url($m['image_url'] ?? null),
            'trails' => array_map(fn($t) => $t['name'], $trailRows),
            'trailDetails' => array_map('fmt_trail', $trailRows)];
}
function fmt_trip(array $t): array {
    $dur = 0;
    if ($t['started_at']) {
        $end = $t['ended_at'] ? strtotime($t['ended_at']) : time();
        $dur = max(0, intdiv($end - strtotime($t['started_at']), 60));
    }
    return [
        'id' => (int) $t['id'], 'mountainId' => (int) $t['mountain_id'], 'mountainName' => $t['mountain_name'],
        'trailName' => $t['trail_name'], 'groupSize' => (int) $t['group_size'], 'plannedDays' => (int) $t['planned_days'],
        'startDate' => iso($t['start_date']), 'expectedReturnAt' => iso($t['expected_return_at']),
        'contactId' => $t['contact_id'] === null ? null : (int) $t['contact_id'], 'notes' => $t['notes'],
        'status' => $t['status'], 'startedAt' => iso($t['started_at']), 'endedAt' => iso($t['ended_at']),
        'isOverdue' => $t['status'] === 'active' && time() > strtotime($t['expected_return_at']),
        'durationMinutes' => $dur,
    ];
}
function fmt_emergency(array $e): array {
    return ['id' => (int) $e['id'], 'type' => $e['type'], 'message' => $e['message'], 'status' => $e['status'],
            'tripId' => $e['trip_id'] === null ? null : (int) $e['trip_id'], 'location' => fmt_loc($e),
            'triggeredAt' => iso($e['triggered_at']), 'resolvedAt' => iso($e['resolved_at'])];
}
function mountain_fields(array $d, bool $req): array {
    $f = [];
    if (isset($d['name'])) $f['name'] = trim((string) $d['name']);
    if (isset($d['elevationMdpl'])) $f['elevation_mdpl'] = int_in($d['elevationMdpl'], 0, 10000, 'elevationMdpl tidak valid');
    if (isset($d['difficulty'])) {
        if (!in_array($d['difficulty'], DIFFICULTY, true)) fail('difficulty harus easy, medium, atau extreme');
        $f['difficulty'] = $d['difficulty'];
    }
    foreach (['province', 'description'] as $k) if (isset($d[$k])) $f[$k] = trim((string) $d[$k]);
    if (isset($d['imageUrl'])) $f['image_url'] = trim((string) $d['imageUrl']);
    foreach (['latitude' => 90, 'longitude' => 180] as $k => $lim) {
        if (!isset($d[$k])) continue;
        if (!is_numeric($d[$k]) || abs((float) $d[$k]) > $lim) fail("$k tidak valid");
        $f[$k] = (float) $d[$k];
    }
    if ($req) foreach (['name', 'elevation_mdpl'] as $k)
        if (!isset($f[$k]) || $f[$k] === '') fail("Field wajib diisi: $k");
    return $f;
}
function trail_fields(array $d, bool $req): array {
    $f = [];
    foreach (['name' => 'name', 'basecampName' => 'basecamp_name'] as $k => $c)
        if (isset($d[$k])) $f[$c] = trim((string) $d[$k]);
    $nums = ['basecampLat' => ['basecamp_lat', 90], 'basecampLng' => ['basecamp_lng', 180],
             'distanceKm' => ['distance_km', null], 'estHours' => ['est_hours', null]];
    foreach ($nums as $k => [$c, $lim]) {
        if (!isset($d[$k])) continue;
        if (!is_numeric($d[$k]) || ($lim !== null && abs((float) $d[$k]) > $lim)) fail("$k tidak valid");
        $f[$c] = (float) $d[$k];
    }
    if ($req && empty($f['name'])) fail('Field wajib diisi: name');
    return $f;
}

/* ================= router ================= */
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$path = '/' . trim(substr(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), strlen($base)), '/');
$method = $_SERVER['REQUEST_METHOD'];

function route(string $m, string $re, &$args = null): bool {
    global $method, $path;
    if ($m !== $method || !preg_match('#^' . $re . '$#', $path, $a)) return false;
    array_shift($a);
    $args = array_map('intval', $a);
    return true;
}

if ($path === '/') out(['app' => 'Mount Tracker API', 'status' => 'ok', 'time' => date('c')]);

/* ---------- auth ---------- */
if (route('POST', '/register')) {
    $d = body();
    $username = trim((string) ($d['username'] ?? ''));
    $email = strtolower(trim((string) ($d['email'] ?? '')));
    $pass = (string) ($d['password'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_.]{3,30}$/', $username)) fail('Username 3-30 karakter (huruf, angka, _ atau .)');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email tidak valid');
    if (strlen($pass) < 6) fail('Password minimal 6 karakter');
    if (isset($d['confirmPassword']) && $d['confirmPassword'] !== $pass) fail('Konfirmasi password tidak sama');
    $st = db()->prepare('SELECT id FROM users WHERE email=? OR username=?');
    $st->execute([$email, $username]);
    if ($st->fetch()) fail('Username atau email sudah terdaftar', 409);
    $id = insert_row('users', ['username' => $username, 'email' => $email, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT)]);
    $u = find_row('users', $id);
    out(['token' => jwt_make(['sub' => $id, 'role' => 'user']), 'user' => fmt_user($u)], 201);
}
if (route('POST', '/login')) {
    $d = body();
    $login = trim((string) ($d['login'] ?? $d['email'] ?? $d['username'] ?? ''));
    $st = db()->prepare('SELECT * FROM users WHERE email=? OR username=?');
    $st->execute([strtolower($login), $login]);
    $u = $st->fetch();
    if (!$u || !password_verify((string) ($d['password'] ?? ''), $u['password_hash'])) fail('Email/username atau password salah', 401);
    out(['token' => jwt_make(['sub' => (int) $u['id'], 'role' => $u['role']]), 'user' => fmt_user($u)]);
}
if (route('POST', '/forgot')) {
    $d = body();
    $st = db()->prepare('SELECT id FROM users WHERE username=? AND email=?');
    $st->execute([trim((string) ($d['username'] ?? '')), strtolower(trim((string) ($d['email'] ?? '')))]);
    $u = $st->fetch();
    if (!$u) fail('Username dan email tidak cocok', 404);
    $token = bin2hex(random_bytes(16));
    db()->prepare('REPLACE INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)')
        ->execute([$u['id'], hash('sha256', $token), date('Y-m-d H:i:s', time() + 900)]);
    out(['resetToken' => $token, 'expiresInMinutes' => 15]);
}
if (route('POST', '/reset')) {
    $d = body();
    $new = (string) ($d['newPassword'] ?? '');
    if (strlen($new) < 6) fail('Password minimal 6 karakter');
    if (isset($d['confirmPassword']) && $d['confirmPassword'] !== $new) fail('Konfirmasi password tidak sama');
    $st = db()->prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at > ?');
    $st->execute([hash('sha256', (string) ($d['resetToken'] ?? '')), date('Y-m-d H:i:s')]);
    $r = $st->fetch();
    if (!$r) fail('Token reset tidak valid atau kadaluarsa', 400);
    db()->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($new, PASSWORD_DEFAULT), $r['user_id']]);
    db()->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$r['user_id']]);
    out(['ok' => true]);
}
if (route('GET', '/me')) out(fmt_user(find_row('users', uid())));

/* ---------- gunung & jalur ---------- */
if (route('GET', '/mountains')) {
    $where = []; $p = [];
    if (!empty($_GET['q'])) { $where[] = 'name LIKE :q'; $p['q'] = '%' . $_GET['q'] . '%'; }
    if (!empty($_GET['difficulty'])) { $where[] = 'difficulty = :df'; $p['df'] = $_GET['difficulty']; }
    $w = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $st = db()->prepare("SELECT * FROM mountains $w ORDER BY name");
    $st->execute($p);
    $rows = $st->fetchAll();
    $tr = trails_for(array_map(fn($r) => (int) $r['id'], $rows));
    out(array_map(fn($m) => fmt_mountain($m, $tr[(int) $m['id']] ?? []), $rows));
}
if (route('GET', '/mountains/(\d+)', $a)) {
    $m = find_row('mountains', $a[0]);
    out(fmt_mountain($m, trails_for([$a[0]])[$a[0]] ?? []));
}
if (route('POST', '/mountains')) {
    auth(true);
    $id = insert_row('mountains', mountain_fields(body(), true));
    out(fmt_mountain(find_row('mountains', $id), []), 201);
}
if (route('PUT', '/mountains/(\d+)', $a)) {
    auth(true);
    find_row('mountains', $a[0]);
    update_row('mountains', $a[0], mountain_fields(body(), false));
    out(fmt_mountain(find_row('mountains', $a[0]), trails_for([$a[0]])[$a[0]] ?? []));
}
if (route('DELETE', '/mountains/(\d+)', $a)) {
    auth(true);
    find_row('mountains', $a[0]);
    db()->prepare('DELETE FROM mountains WHERE id=?')->execute([$a[0]]);
    out(['deleted' => true]);
}
if (route('POST', '/mountains/(\d+)/trails', $a)) {
    auth(true);
    find_row('mountains', $a[0]);
    $f = trail_fields(body(), true);
    $f['mountain_id'] = $a[0];
    out(fmt_trail(find_row('trails', insert_row('trails', $f))), 201);
}
if (route('PUT', '/trails/(\d+)', $a)) {
    auth(true);
    find_row('trails', $a[0]);
    update_row('trails', $a[0], trail_fields(body(), false));
    out(fmt_trail(find_row('trails', $a[0])));
}
if (route('DELETE', '/trails/(\d+)', $a)) {
    auth(true);
    find_row('trails', $a[0]);
    db()->prepare('DELETE FROM trails WHERE id=?')->execute([$a[0]]);
    out(['deleted' => true]);
}

/* ---------- kontak darurat ---------- */
if (route('GET', '/contacts')) {
    $st = db()->prepare('SELECT * FROM emergency_contacts WHERE user_id=? ORDER BY is_primary DESC, id');
    $st->execute([uid()]);
    out(array_map('fmt_contact', $st->fetchAll()));
}
if (route('POST', '/contacts')) {
    $u = uid();
    $d = body();
    $name = trim((string) ($d['name'] ?? ''));
    $phone = preg_replace('/[\s-]/', '', (string) ($d['phone'] ?? ''));
    $rel = trim((string) ($d['relationship'] ?? ''));
    if ($name === '') fail('Nama wajib diisi');
    if (!preg_match('/^\+?[0-9]{8,15}$/', $phone)) fail('Nomor telepon harus 8-15 angka');
    $cnt = db()->prepare('SELECT COUNT(*) FROM emergency_contacts WHERE user_id=?');
    $cnt->execute([$u]);
    $primary = ((int) $cnt->fetchColumn() === 0) || !empty($d['isPrimary']); // kontak pertama otomatis utama
    if ($primary) db()->prepare('UPDATE emergency_contacts SET is_primary=0 WHERE user_id=?')->execute([$u]);
    $id = insert_row('emergency_contacts', ['user_id' => $u, 'name' => $name, 'phone' => $phone, 'relationship' => $rel, 'is_primary' => $primary ? 1 : 0]);
    out(fmt_contact(own_row('emergency_contacts', $id, $u)), 201);
}
if (route('PUT', '/contacts/(\d+)/primary', $a)) {
    $u = uid();
    own_row('emergency_contacts', $a[0], $u);
    db()->prepare('UPDATE emergency_contacts SET is_primary = (id = ?) WHERE user_id=?')->execute([$a[0], $u]);
    out(fmt_contact(own_row('emergency_contacts', $a[0], $u)));
}
if (route('DELETE', '/contacts/(\d+)', $a)) {
    $u = uid();
    $c = own_row('emergency_contacts', $a[0], $u);
    db()->prepare('DELETE FROM emergency_contacts WHERE id=?')->execute([$a[0]]);
    if ($c['is_primary']) // kontak utama dihapus -> kontak tertua berikutnya jadi utama
        db()->prepare('UPDATE emergency_contacts SET is_primary=1 WHERE user_id=? ORDER BY id LIMIT 1')->execute([$u]);
    out(['deleted' => true]);
}

/* ---------- pendakian (trip) ---------- */
if (route('GET', '/trips')) {
    $sql = 'SELECT t.*, m.name AS mountain_name FROM trips t JOIN mountains m ON m.id=t.mountain_id WHERE t.user_id=?';
    $p = [uid()];
    if (!empty($_GET['status'])) { $sql .= ' AND t.status=?'; $p[] = $_GET['status']; }
    $st = db()->prepare($sql . ' ORDER BY t.id DESC');
    $st->execute($p);
    out(array_map('fmt_trip', $st->fetchAll()));
}
if (route('POST', '/trips')) {
    $u = uid();
    $d = body();
    $m = find_row('mountains', (int) ($d['mountainId'] ?? 0));
    $trail = trim((string) ($d['trailName'] ?? ''));
    if ($trail === '') fail('Jalur wajib dipilih');
    $chk = db()->prepare('SELECT id FROM trails WHERE mountain_id=? AND name=?');
    $chk->execute([$m['id'], $trail]);
    if (!$chk->fetch()) fail('Jalur tidak ada di gunung ini');
    $size = int_in($d['groupSize'] ?? 1, 1, null, 'Jumlah orang minimal 1');
    $days = int_in($d['plannedDays'] ?? 1, 1, 14, 'Lama pendakian harus 1-14 hari');
    $sd = parse_dt($d['startDate'] ?? null);
    if (!$sd) fail('Tanggal berangkat tidak valid');
    $startDay = $sd->setTime(0, 0);
    if ($startDay < new DateTimeImmutable('today')) fail('Tanggal berangkat tidak boleh di masa lalu');
    if (isset($d['expectedReturnAt'])) {
        $ret = parse_dt($d['expectedReturnAt']);
        if (!$ret) fail('Estimasi turun tidak valid');
    } else {
        $ret = $startDay->modify('+' . ($days - 1) . ' days')->setTime(18, 0);
    }
    if ($ret <= $startDay) fail('Estimasi turun harus setelah tanggal berangkat');
    if (isset($d['contactId'])) {
        $cid = (int) own_row('emergency_contacts', (int) $d['contactId'], $u)['id'];
    } else { // default: kontak utama
        $pc = db()->prepare('SELECT id FROM emergency_contacts WHERE user_id=? AND is_primary=1');
        $pc->execute([$u]);
        $cid = ($r = $pc->fetch()) ? (int) $r['id'] : null;
    }
    $id = insert_row('trips', [
        'user_id' => $u, 'mountain_id' => $m['id'], 'trail_name' => $trail, 'group_size' => $size, 'planned_days' => $days,
        'start_date' => sql_dt($sd), 'expected_return_at' => sql_dt($ret), 'contact_id' => $cid,
        'notes' => trim((string) ($d['notes'] ?? '')), 'status' => 'planned',
    ]);
    out(fmt_trip(own_trip($id, $u)), 201);
}
if (route('GET', '/trips/(\d+)', $a)) {
    $t = own_trip($a[0], uid());
    $st = db()->prepare('SELECT * FROM trip_locations WHERE trip_id=? ORDER BY recorded_at, id');
    $st->execute([$a[0]]);
    $locs = array_map(fn($r) => fmt_loc($r, 'recorded_at'), $st->fetchAll());
    $out = fmt_trip($t);
    $out['locations'] = $locs;
    $avail = array_values(array_filter($locs, fn($l) => $l['source'] !== 'unavailable'));
    $out['lastKnownLocation'] = $avail ? end($avail) : null;
    out($out);
}
if (route('POST', '/trips/(\d+)/start', $a)) {
    $u = uid();
    $t = own_trip($a[0], $u);
    if ($t['status'] !== 'planned') fail('Hanya pendakian berstatus direncanakan yang bisa dimulai', 409);
    $ac = db()->prepare("SELECT id FROM trips WHERE user_id=? AND status='active' LIMIT 1");
    $ac->execute([$u]);
    if ($ac->fetch()) fail('Masih ada pendakian aktif. Akhiri dulu sebelum memulai yang baru.', 409);
    update_row('trips', $a[0], ['status' => 'active', 'started_at' => date('Y-m-d H:i:s')]);
    out(fmt_trip(own_trip($a[0], $u)));
}
if (route('POST', '/trips/(\d+)/finish', $a)) {
    $u = uid();
    if (own_trip($a[0], $u)['status'] !== 'active') fail('Hanya pendakian aktif yang bisa diakhiri', 409);
    update_row('trips', $a[0], ['status' => 'finished', 'ended_at' => date('Y-m-d H:i:s')]);
    out(fmt_trip(own_trip($a[0], $u)));
}
if (route('POST', '/trips/(\d+)/cancel', $a)) {
    $u = uid();
    if (!in_array(own_trip($a[0], $u)['status'], ['planned', 'active'], true)) fail('Pendakian ini sudah selesai atau dibatalkan', 409);
    update_row('trips', $a[0], ['status' => 'cancelled', 'ended_at' => date('Y-m-d H:i:s')]);
    out(fmt_trip(own_trip($a[0], $u)));
}
// Kirim 1 lokasi {latitude, longitude, ...} atau banyak sekaligus {"locations":[...]}
if (route('POST', '/trips/(\d+)/locations', $a)) {
    $u = uid();
    if (own_trip($a[0], $u)['status'] !== 'active') fail('Lokasi hanya dicatat saat pendakian aktif', 409);
    $d = body();
    $items = (isset($d['locations']) && is_array($d['locations'])) ? $d['locations'] : [$d];
    if (count($items) > 200) fail('Maksimal 200 lokasi per request');
    db()->beginTransaction();
    foreach ($items as $it) {
        if (!is_array($it)) fail('Data lokasi tidak valid');
        $f = loc_fields($it);
        $f['trip_id'] = $a[0];
        $f['recorded_at'] = sql_dt(parse_dt($it['recordedAt'] ?? null) ?? new DateTimeImmutable());
        insert_row('trip_locations', $f);
    }
    db()->commit();
    out(['saved' => count($items)], 201);
}

/* ---------- darurat / SOS ---------- */
if (route('GET', '/emergencies')) {
    $st = db()->prepare('SELECT * FROM emergency_events WHERE user_id=? ORDER BY id DESC');
    $st->execute([uid()]);
    out(array_map('fmt_emergency', $st->fetchAll()));
}
if (route('POST', '/emergencies')) {
    $u = uid();
    $d = body();
    $type = $d['type'] ?? 'sos';
    if (!in_array($type, ['sos', 'lost', 'injury', 'weather', 'other'], true)) fail('type tidak valid');
    if (isset($d['tripId'])) {
        $tripId = (int) own_trip((int) $d['tripId'], $u)['id'];
    } else { // default: pendakian yang sedang aktif
        $ac = db()->prepare("SELECT id FROM trips WHERE user_id=? AND status='active' LIMIT 1");
        $ac->execute([$u]);
        $tripId = ($r = $ac->fetch()) ? (int) $r['id'] : null;
    }
    $f = loc_fields(isset($d['location']) && is_array($d['location']) ? $d['location'] : $d);
    if ($f['source'] === 'unavailable' && $tripId) { // GPS gagal -> pakai lokasi terakhir yang diketahui
        $ll = db()->prepare("SELECT * FROM trip_locations WHERE trip_id=? AND source<>'unavailable' ORDER BY recorded_at DESC, id DESC LIMIT 1");
        $ll->execute([$tripId]);
        if ($row = $ll->fetch()) {
            $f = ['latitude' => $row['latitude'], 'longitude' => $row['longitude'], 'altitude_m' => $row['altitude_m'],
                  'accuracy_m' => $row['accuracy_m'], 'source' => $row['source']];
        }
    }
    $f += ['user_id' => $u, 'trip_id' => $tripId, 'type' => $type, 'message' => trim((string) ($d['message'] ?? '')),
           'status' => 'active', 'triggered_at' => date('Y-m-d H:i:s')];
    $id = insert_row('emergency_events', $f);
    out(fmt_emergency(own_row('emergency_events', $id, $u)), 201);
}
if (route('POST', '/emergencies/(\d+)/resolve', $a)) {
    $u = uid();
    $e = own_row('emergency_events', $a[0], $u);
    $status = body()['status'] ?? 'resolved';
    if (!in_array($status, ['resolved', 'cancelled'], true)) fail('Status penutup tidak valid');
    if ($e['status'] !== 'active') fail('Kondisi darurat ini sudah ditutup', 409);
    update_row('emergency_events', $a[0], ['status' => $status, 'resolved_at' => date('Y-m-d H:i:s')]);
    out(fmt_emergency(own_row('emergency_events', $a[0], $u)));
}

/* ---------- laporan kendala (Status Sistem) ---------- */
if (route('GET', '/issues')) {
    $st = db()->prepare('SELECT * FROM issues WHERE user_id=? ORDER BY id DESC');
    $st->execute([uid()]);
    out(array_map(fn($i) => ['id' => (int) $i['id'], 'category' => $i['category'], 'description' => $i['description'],
                             'status' => $i['status'], 'createdAt' => iso($i['created_at'])], $st->fetchAll()));
}
if (route('POST', '/issues')) {
    $u = uid();
    $d = body();
    $desc = trim((string) ($d['description'] ?? ''));
    if ($desc === '') fail('Deskripsi kendala wajib diisi');
    $id = insert_row('issues', ['user_id' => $u, 'category' => trim((string) ($d['category'] ?? 'other')) ?: 'other',
                                'description' => $desc, 'status' => 'open', 'created_at' => date('Y-m-d H:i:s')]);
    $i = own_row('issues', $id, $u);
    out(['id' => $id, 'category' => $i['category'], 'description' => $i['description'], 'status' => 'open', 'createdAt' => iso($i['created_at'])], 201);
}

fail('Endpoint tidak ditemukan', 404);
