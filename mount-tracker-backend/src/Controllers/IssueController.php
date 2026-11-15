<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database as DB;
use App\Core\Fmt;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;

/** Laporan kendala dari halaman Status Sistem. */
final class IssueController
{
    private static function format(array $i): array
    {
        return ['id' => (int) $i['id'], 'category' => $i['category'], 'description' => $i['description'],
                'status' => $i['status'], 'createdAt' => Fmt::iso($i['created_at'])];
    }

    public function index(Request $r): void
    {
        Response::ok(array_map([self::class, 'format'], DB::all('SELECT * FROM issues WHERE user_id=? ORDER BY id DESC', [$r->userId()])));
    }

    public function store(Request $r): void
    {
        $f = (new Validator($r->body()))
            ->string('category', 'Kategori', false, 1, 60)
            ->string('description', 'Deskripsi kendala', true, 3, 2000)
            ->validate();
        $id = DB::insert('issues', ['user_id' => $r->userId(), 'category' => $f['category'] ?? 'Lainnya',
            'description' => $f['description'], 'status' => 'open', 'created_at' => Fmt::now()]);
        Response::created(self::format(DB::one('SELECT * FROM issues WHERE id=?', [$id])), 'Laporan tersimpan');
    }
}
