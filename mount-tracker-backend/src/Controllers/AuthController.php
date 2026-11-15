<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\HttpClient;
use App\Core\HttpException;
use App\Core\Jwt;
use App\Core\Mailer;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\PasswordReset;
use App\Models\User;

final class AuthController
{
    private const USERNAME_RE = '/^[A-Za-z0-9_.]{3,30}$/';
    private const USERNAME_MSG = 'Username 3-30 karakter (huruf, angka, _ atau .)';

    private function session(array $u, string $message, int $status = 200): never
    {
        $data = ['token' => Jwt::encode(['sub' => (int) $u['id'], 'role' => $u['role']]), 'user' => User::format($u)];
        $status === 201 ? Response::created($data, $message) : Response::ok($data, $message);
    }

    private static function passwordRules(Validator $v, array $d, string $key): void
    {
        $v->string($key, 'Password', true, 6, 72);
        if (isset($d['confirmPassword']) && $d['confirmPassword'] !== ($d[$key] ?? null)) {
            $v->fail('confirmPassword', 'Konfirmasi password tidak sama');
        }
    }

    /** POST /register */
    public function register(Request $r): void
    {
        $d = $r->body();
        $v = (new Validator($d))
            ->string('username', 'Username', true, 3, 30, self::USERNAME_RE, self::USERNAME_MSG)
            ->email('email', 'Email', true);
        self::passwordRules($v, $d, 'password');
        $f = $v->validate();

        $dup = User::exists($f['username'], $f['email']);
        if ($dup['username']) throw HttpException::conflict('Username sudah dipakai');
        if ($dup['email']) throw HttpException::conflict('Email sudah terdaftar');

        $u = User::create([
            'username' => $f['username'],
            'email' => $f['email'],
            'password_hash' => password_hash($f['password'], PASSWORD_DEFAULT),
        ]);
        $this->session($u, 'Registrasi berhasil', 201);
    }

    /** POST /login  body: login (email atau username) + password */
    public function login(Request $r): void
    {
        $d = $r->body();
        $d['login'] = $d['login'] ?? $d['identity'] ?? $d['email'] ?? $d['username'] ?? null;
        $f = (new Validator($d))
            ->string('login', 'Email/username', true, 1, 150)
            ->string('password', 'Password', true, 1, 72)
            ->validate();
        $u = User::findByLogin($f['login']);
        if (!$u || !password_verify($f['password'], $u['password_hash'])) {
            throw HttpException::unauthorized('Email/username atau password salah');
        }
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
            User::update((int) $u['id'], ['password_hash' => password_hash($f['password'], PASSWORD_DEFAULT)]);
        }
        $this->session($u, 'Login berhasil');
    }

    /** POST /forgot  body: email (+ username opsional). Mengirim kode 6 digit ke email. */
    public function forgot(Request $r): void
    {
        $f = (new Validator($r->body()))
            ->email('email', 'Email', true)
            ->string('username', 'Username', false, 3, 30, self::USERNAME_RE, self::USERNAME_MSG)
            ->validate();
        $u = User::findByEmail($f['email']);
        if ($u && isset($f['username']) && strcasecmp($u['username'], $f['username']) !== 0) $u = null;

        $data = ['expiresInMinutes' => PasswordReset::TTL_MINUTES];
        if ($u) {
            $code = PasswordReset::issue((int) $u['id']);
            $mins = PasswordReset::TTL_MINUTES;
            $name = htmlspecialchars($u['display_name'] ?: $u['username']);
            try {
                $data['deliveredVia'] = Mailer::send(
                    $u['email'],
                    'Kode reset password Mount Tracker',
                    "<p>Halo $name,</p><p>Kode reset password kamu:</p><h2 style=\"letter-spacing:4px\">$code</h2>"
                    . "<p>Kode berlaku $mins menit. Abaikan email ini jika kamu tidak meminta reset password.</p>",
                    "Halo $name,\n\nKode reset password Mount Tracker: $code\nBerlaku $mins menit.\n"
                );
            } catch (\Throwable $e) {
                error_log('[mail] ' . $e->getMessage());
                PasswordReset::clear((int) $u['id']);
                throw new HttpException('Gagal mengirim email reset. Periksa pengaturan MAIL_* di .env backend.', 502);
            }
            if (App::config('debug')) $data['debugCode'] = $code; // hanya untuk pengujian lokal
        }
        // Pesan sama untuk email terdaftar/tidak agar tidak membocorkan data akun.
        Response::ok($data, 'Jika data cocok, kode reset sudah dikirim ke email kamu');
    }

    /** POST /reset  body: email, code, newPassword, confirmPassword */
    public function reset(Request $r): void
    {
        $d = $r->body();
        $d['newPassword'] = $d['newPassword'] ?? $d['password'] ?? null;
        $d['code'] = $d['code'] ?? $d['resetToken'] ?? null;
        $v = (new Validator($d))
            ->email('email', 'Email', true)
            ->string('code', 'Kode reset', true, 6, 6, '/^\d{6}$/', 'Kode reset harus 6 digit angka');
        $v->string('newPassword', 'Password baru', true, 6, 72);
        if (isset($d['confirmPassword']) && $d['confirmPassword'] !== $d['newPassword']) $v->fail('confirmPassword', 'Konfirmasi password tidak sama');
        $f = $v->validate();

        $u = User::findByEmail($f['email']) ?? throw new HttpException('Kode reset tidak valid atau sudah kedaluwarsa. Minta kode baru.', 400);
        if ($err = PasswordReset::verify((int) $u['id'], $f['code'])) throw new HttpException($err, 400);
        User::update((int) $u['id'], ['password_hash' => password_hash($f['newPassword'], PASSWORD_DEFAULT)]);
        PasswordReset::clear((int) $u['id']);
        Response::ok(null, 'Password berhasil diganti, silakan login');
    }

    /** POST /auth/google  body: idToken (dari Google Sign-In di aplikasi) */
    public function google(Request $r): void
    {
        $f = (new Validator($r->body()))->string('idToken', 'idToken', true, 20, 4096)->validate();
        $clientIds = App::config('google_client_ids', []);
        if (!$clientIds) throw new HttpException('Login Google belum dikonfigurasi di server (GOOGLE_CLIENT_IDS kosong)', 503);

        try {
            $res = HttpClient::getJson('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($f['idToken']));
        } catch (\Throwable $e) {
            throw new HttpException('Tidak dapat memverifikasi akun Google, coba lagi', 502);
        }
        $p = $res['json'];
        $valid = $res['status'] === 200 && is_array($p)
            && in_array($p['aud'] ?? '', $clientIds, true)
            && in_array($p['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            && (int) ($p['exp'] ?? 0) > time()
            && in_array($p['email_verified'] ?? false, [true, 'true'], true)
            && !empty($p['sub']) && !empty($p['email']);
        if (!$valid) throw HttpException::unauthorized('Token Google tidak valid');

        $sub = (string) $p['sub'];
        $email = strtolower((string) $p['email']);
        $u = User::findByGoogleSub($sub);
        if (!$u && ($u = User::findByEmail($email))) {
            $u = User::update((int) $u['id'], ['google_sub' => $sub]); // tautkan ke akun yang sudah ada
        }
        $created = false;
        if (!$u) {
            $u = User::create([
                'username' => User::uniqueUsername(strstr($email, '@', true) ?: 'pendaki'),
                'email' => $email,
                'display_name' => mb_substr((string) ($p['name'] ?? ''), 0, 100),
                'password_hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
                'google_sub' => $sub,
            ]);
            $created = true;
        }
        $this->session($u, 'Login Google berhasil', $created ? 201 : 200);
    }

    /** GET /me */
    public function me(Request $r): void
    {
        Response::ok(User::format(User::find($r->userId())));
    }

    /** PUT /me  body: displayName?, email?, currentPassword + newPassword (opsional) */
    public function updateMe(Request $r): void
    {
        $d = $r->body();
        $v = (new Validator($d))
            ->string('displayName', 'Nama tampilan', false, 0, 100)
            ->email('email', 'Email');
        if (isset($d['newPassword'])) {
            $v->string('newPassword', 'Password baru', true, 6, 72)->string('currentPassword', 'Password lama', true, 1, 72);
        }
        $f = $v->validate();
        $u = User::find($r->userId());
        $upd = [];
        if (array_key_exists('displayName', $d)) $upd['display_name'] = $f['displayName'] ?? '';
        if (isset($f['email']) && $f['email'] !== $u['email']) {
            if (User::exists('', $f['email'], (int) $u['id'])['email']) throw HttpException::conflict('Email sudah dipakai akun lain');
            $upd['email'] = $f['email'];
        }
        if (isset($f['newPassword'])) {
            if (!password_verify($f['currentPassword'], $u['password_hash'])) throw new HttpException('Password lama salah', 400);
            $upd['password_hash'] = password_hash($f['newPassword'], PASSWORD_DEFAULT);
        }
        Response::ok(User::format($upd ? User::update((int) $u['id'], $upd) : $u), 'Profil diperbarui');
    }
}
