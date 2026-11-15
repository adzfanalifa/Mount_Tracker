<?php
declare(strict_types=1);

namespace App\Core;

final class Request
{
    private ?array $body = null;
    public array $params = [];   // parameter dari path, contoh {id}
    public ?array $user = null;  // payload JWT setelah lewat middleware Auth

    public function __construct(public readonly string $method, public readonly string $path) {}

    public static function capture(): self
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        // Dukung akses lewat sub-folder (Laragon: /mount-tracker-backend/public/...).
        $script = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
        foreach ([$script, preg_replace('#/public$#', '', $script)] as $base) {
            if ($base && $base !== '/' && str_starts_with($uri, $base . '/')) { $uri = substr($uri, strlen($base)); break; }
            if ($base && $base !== '/' && $uri === $base) { $uri = '/'; break; }
        }
        $uri = preg_replace('#^/index\.php#', '', $uri);
        $uri = preg_replace('#^/api(?=/|$)#', '', $uri); // prefix /api opsional
        $path = '/' . trim((string) $uri, '/');
        return new self(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), $path);
    }

    public function body(): array
    {
        if ($this->body === null) {
            $raw = file_get_contents('php://input') ?: '';
            $d = json_decode($raw, true);
            if ($raw !== '' && !is_array($d) && $_POST === []) {
                throw new HttpException('Body harus berupa JSON yang valid', 400);
            }
            $this->body = is_array($d) ? $d : $_POST;
        }
        return $this->body;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body()[$key] ?? $default;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        $v = $_GET[$key] ?? null;
        return ($v === null || $v === '') ? $default : $v;
    }

    public function param(string $key): int
    {
        return (int) ($this->params[$key] ?? 0);
    }

    public function userId(): int
    {
        return (int) ($this->user['sub'] ?? 0);
    }

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $v = $_SERVER[$key] ?? $_SERVER['REDIRECT_' . $key] ?? null;
        if ($v === null && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $val) if (strcasecmp($k, $name) === 0) return $val;
        }
        return $v;
    }

    public function baseUrl(): string
    {
        if ($u = App::config('url')) return rtrim($u, '/');
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
    }
}
