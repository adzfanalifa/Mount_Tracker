<?php
declare(strict_types=1);

use App\Controllers\AuthController as A;
use App\Controllers\ContactController as C;
use App\Controllers\HealthController as H;
use App\Controllers\IssueController as I;
use App\Controllers\MountainController as M;
use App\Controllers\SosController as S;
use App\Controllers\StatusController;
use App\Controllers\TripController as T;
use App\Controllers\WeatherController as W;
use App\Core\Router;
use App\Middleware\Admin;
use App\Middleware\Auth;

return function (Router $r): void {
    $auth = [Auth::class];
    $admin = [Admin::class];

    $r->get('/', [StatusController::class, 'index']);

    // 1. Auth (semua path juga bisa diawali /auth, contoh /auth/login)
    foreach (['', '/auth'] as $p) {
        $r->post("$p/register", [A::class, 'register']);
        $r->post("$p/login", [A::class, 'login']);
        $r->post("$p/forgot", [A::class, 'forgot']);
        $r->post("$p/forgot-password", [A::class, 'forgot']);
        $r->post("$p/reset", [A::class, 'reset']);
        $r->post("$p/reset-password", [A::class, 'reset']);
    }
    $r->post('/auth/google', [A::class, 'google']);
    $r->get('/me', [A::class, 'me'], $auth);
    $r->put('/me', [A::class, 'updateMe'], $auth);

    // 2-3. Gunung, jalur, pos
    $r->get('/mountains', [M::class, 'index']);
    $r->get('/mountains/{id}', [M::class, 'show']);
    $r->get('/mountains/{id}/trails', [M::class, 'trails']);
    $r->get('/trails/{id}', [M::class, 'trail']);
    $r->get('/trails/{id}/checkpoints', [M::class, 'checkpoints']);
    $r->post('/mountains', [M::class, 'store'], $admin);
    $r->put('/mountains/{id}', [M::class, 'update'], $admin);
    $r->delete('/mountains/{id}', [M::class, 'destroy'], $admin);
    $r->post('/mountains/{id}/trails', [M::class, 'storeTrail'], $admin);
    $r->put('/trails/{id}', [M::class, 'updateTrail'], $admin);
    $r->delete('/trails/{id}', [M::class, 'destroyTrail'], $admin);
    $r->post('/trails/{id}/checkpoints', [M::class, 'storeCheckpoint'], $admin);
    $r->put('/checkpoints/{id}', [M::class, 'updateCheckpoint'], $admin);
    $r->delete('/checkpoints/{id}', [M::class, 'destroyCheckpoint'], $admin);

    // 4-5. Pendakian & check-in pos
    $r->get('/trips', [T::class, 'index'], $auth);
    $r->post('/trips', [T::class, 'store'], $auth);
    $r->get('/trips/active', [T::class, 'active'], $auth);
    $r->get('/trips/{id}', [T::class, 'show'], $auth);
    $r->post('/trips/{id}/start', [T::class, 'start'], $auth);
    $r->post('/trips/{id}/finish', [T::class, 'finish'], $auth);
    $r->post('/trips/{id}/cancel', [T::class, 'cancel'], $auth);
    $r->post('/trips/{id}/locations', [T::class, 'addLocations'], $auth);
    $r->get('/trips/{id}/checkpoints', [T::class, 'checkpoints'], $auth);
    $r->get('/trips/{id}/checkins', [T::class, 'checkpoints'], $auth);
    $r->post('/trips/{id}/checkins', [T::class, 'checkin'], $auth);

    // 6. Health
    $r->get('/health', [H::class, 'index'], $auth);
    $r->post('/health', [H::class, 'store'], $auth);

    // 7. SOS & kontak darurat (/emergencies = alias lama)
    foreach (['/sos', '/emergencies'] as $p) {
        $r->get($p, [S::class, 'index'], $auth);
        $r->post($p, [S::class, 'store'], $auth);
        $r->post("$p/{id}/resolve", [S::class, 'resolve'], $auth);
    }
    $r->get('/contacts', [C::class, 'index'], $auth);
    $r->post('/contacts', [C::class, 'store'], $auth);
    $r->put('/contacts/{id}', [C::class, 'update'], $auth);
    $r->put('/contacts/{id}/primary', [C::class, 'primary'], $auth);
    $r->delete('/contacts/{id}', [C::class, 'destroy'], $auth);

    // 8. Cuaca per jam
    $r->get('/weather', [W::class, 'hourly']);

    // Laporan kendala
    $r->get('/issues', [I::class, 'index'], $auth);
    $r->post('/issues', [I::class, 'store'], $auth);
};
