<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\App;

final class Cors
{
    public static function apply(string $method): void
    {
        header('Access-Control-Allow-Origin: ' . App::config('cors_origin', '*'));
        header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Max-Age: 86400');
        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
