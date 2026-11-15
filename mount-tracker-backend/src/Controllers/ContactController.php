<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database as DB;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Contact;

final class ContactController
{
    private function fields(array $d, bool $create): array
    {
        if (isset($d['phone'])) $d['phone'] = preg_replace('/[\s\-()]/', '', (string) $d['phone']);
        return (new Validator($d))
            ->string('name', 'Nama', $create, 1, 100)
            ->string('phone', 'Nomor telepon', $create, 8, 16, '/^\+?[0-9]{8,15}$/', 'Nomor telepon harus 8-15 angka')
            ->string('relationship', 'Hubungan', false, 0, 60)
            ->bool('isPrimary')
            ->validate();
    }

    /** GET /contacts */
    public function index(Request $r): void
    {
        Response::ok(array_map([Contact::class, 'format'], Contact::list($r->userId())));
    }

    /** POST /contacts */
    public function store(Request $r): void
    {
        $uid = $r->userId();
        $f = $this->fields($r->body(), true);
        $primary = Contact::count($uid) === 0 || !empty($f['isPrimary']); // kontak pertama otomatis utama
        $id = DB::transaction(function () use ($uid, $f, $primary) {
            if ($primary) DB::run('UPDATE emergency_contacts SET is_primary=0 WHERE user_id=?', [$uid]);
            return DB::insert('emergency_contacts', [
                'user_id' => $uid, 'name' => $f['name'], 'phone' => $f['phone'],
                'relationship' => $f['relationship'] ?? '', 'is_primary' => (int) $primary,
            ]);
        });
        Response::created(Contact::format(Contact::findOwned($id, $uid)), 'Kontak darurat ditambahkan');
    }

    /** PUT /contacts/{id} */
    public function update(Request $r): void
    {
        $uid = $r->userId();
        $c = Contact::findOwned($r->param('id'), $uid);
        $f = $this->fields($r->body(), false);
        $upd = [];
        foreach (['name' => 'name', 'phone' => 'phone', 'relationship' => 'relationship'] as $k => $col) {
            if (array_key_exists($k, $f)) $upd[$col] = $f[$k];
        }
        DB::update('emergency_contacts', (int) $c['id'], $upd);
        if (!empty($f['isPrimary'])) Contact::setPrimary((int) $c['id'], $uid);
        Response::ok(Contact::format(Contact::findOwned((int) $c['id'], $uid)), 'Kontak diperbarui');
    }

    /** PUT /contacts/{id}/primary */
    public function primary(Request $r): void
    {
        $uid = $r->userId();
        $c = Contact::findOwned($r->param('id'), $uid);
        Contact::setPrimary((int) $c['id'], $uid);
        Response::ok(Contact::format(Contact::findOwned((int) $c['id'], $uid)), 'Kontak utama diganti');
    }

    /** DELETE /contacts/{id} */
    public function destroy(Request $r): void
    {
        $uid = $r->userId();
        $c = Contact::findOwned($r->param('id'), $uid);
        DB::transaction(function () use ($c, $uid) {
            DB::run('DELETE FROM emergency_contacts WHERE id=?', [$c['id']]);
            if ($c['is_primary']) { // kontak utama dihapus -> kontak tertua berikutnya jadi utama
                DB::run('UPDATE emergency_contacts SET is_primary=1 WHERE user_id=? ORDER BY id LIMIT 1', [$uid]);
            }
        });
        Response::ok(null, 'Kontak dihapus');
    }
}
