<?php
declare(strict_types=1);

namespace App\Core;

/** Router sederhana: path seperti /trips/{id}/start, middleware per rute. */
final class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, array $handler, array $middleware = []): void
    {
        $re = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>\d+)', $pattern) . '$#';
        $this->routes[] = [$method, $re, $handler, $middleware];
    }

    public function get(string $p, array $h, array $m = []): void { $this->add('GET', $p, $h, $m); }
    public function post(string $p, array $h, array $m = []): void { $this->add('POST', $p, $h, $m); }
    public function put(string $p, array $h, array $m = []): void { $this->add('PUT', $p, $h, $m); }
    public function delete(string $p, array $h, array $m = []): void { $this->add('DELETE', $p, $h, $m); }

    public function dispatch(Request $req): never
    {
        $allowed = [];
        foreach ($this->routes as [$method, $re, $handler, $middleware]) {
            if (!preg_match($re, $req->path, $m)) continue;
            if ($method !== $req->method) { $allowed[] = $method; continue; }
            $req->params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            foreach ($middleware as $mw) (new $mw())->handle($req);
            [$class, $fn] = $handler;
            (new $class())->$fn($req);
            Response::ok(); // controller seharusnya sudah mengirim response
        }
        if ($allowed) Response::error('Method tidak didukung untuk endpoint ini', 405);
        Response::error('Endpoint tidak ditemukan', 404);
    }
}
