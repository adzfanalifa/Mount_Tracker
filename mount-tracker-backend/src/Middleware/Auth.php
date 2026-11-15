<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Jwt;
use App\Core\Request;
use App\Models\User;

/** Wajib login: header Authorization: Bearer <token>. */
class Auth
{
    public function handle(Request $req): void
    {
        $h = (string) $req->header('Authorization');
        if (!preg_match('/^Bearer\s+(\S+)$/i', $h, $m)) throw HttpException::unauthorized('Token diperlukan');
        $p = Jwt::decode($m[1]);
        if (!$p) throw HttpException::unauthorized('Token tidak valid atau kedaluwarsa, silakan login ulang');
        $u = User::find((int) ($p['sub'] ?? 0));
        if (!$u) throw HttpException::unauthorized('Akun tidak ditemukan, silakan login ulang');
        $p['role'] = $u['role']; // role terbaru dari DB
        $req->user = $p;
    }
}
