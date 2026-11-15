<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;

/** Wajib login sebagai admin. */
final class Admin extends Auth
{
    public function handle(Request $req): void
    {
        parent::handle($req);
        if (($req->user['role'] ?? '') !== 'admin') throw HttpException::forbidden('Khusus admin');
    }
}
