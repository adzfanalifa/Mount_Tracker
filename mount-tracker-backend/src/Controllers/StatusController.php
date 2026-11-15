<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Database as DB;
use App\Core\Request;
use App\Core\Response;

final class StatusController
{
    /** GET / : cek server & database (dipakai aplikasi untuk tes koneksi). */
    public function index(Request $r): void
    {
        try {
            DB::value('SELECT 1');
            $db = 'ok';
        } catch (\Throwable $e) {
            $db = 'error';
        }
        Response::ok([
            'app' => App::config('app_name'),
            'database' => $db,
            'googleLogin' => (bool) App::config('google_client_ids'),
            'mail' => App::config('mail.username') ? 'smtp' : 'mailpit',
            'time' => date('c'),
        ], $db === 'ok' ? 'Server berjalan' : 'Server berjalan, tetapi database tidak terhubung');
    }
}
