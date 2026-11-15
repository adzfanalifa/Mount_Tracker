<?php
declare(strict_types=1);

/**
 * Mount Tracker API - front controller.
 * Jalankan: php -S 0.0.0.0:8000 -t public public/index.php
 */

use App\Core\App;
use App\Core\Env;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Middleware\Cors;

$root = dirname(__DIR__);

// File statis (gambar) saat memakai server bawaan PHP.
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($file !== __FILE__ && is_file($file)) return false;
}

// Autoload: Composer jika ada, plus autoloader PSR-4 sederhana untuk App\.
if (is_file("$root/vendor/autoload.php")) require "$root/vendor/autoload.php";
spl_autoload_register(function (string $class) use ($root): void {
    if (str_starts_with($class, 'App\\')) {
        $f = "$root/src/" . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (is_file($f)) require $f;
    }
});

Env::load("$root/.env");
App::boot(require "$root/config/config.php");
ini_set('display_errors', '0');

$req = Request::capture();
Cors::apply($req->method);

set_exception_handler(function (Throwable $e): void {
    if ($e instanceof HttpException) Response::error($e->getMessage(), $e->status(), $e->errors());
    error_log('[mount-tracker] ' . $e);
    if ($e instanceof PDOException) {
        $state = (string) $e->getCode();
        if ($state === '23000') Response::error('Data duplikat atau relasi tidak valid', 409);
        if (in_array($state, ['2002', '2006', '1045', '1049'], true)) { // tidak bisa konek / login / DB tidak ada
            Response::error('Database tidak dapat dihubungi. Periksa MySQL dan pengaturan DB_* di .env', 503);
        }
    }
    Response::error(App::config('debug') ? 'Terjadi kesalahan server: ' . $e->getMessage() : 'Terjadi kesalahan server', 500);
});

$router = new Router();
(require "$root/config/routes.php")($router);
$router->dispatch($req);
