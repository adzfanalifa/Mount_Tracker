<?php
declare(strict_types=1);

namespace App\Core;

/** Semua response memakai format seragam: {success, message, data}. */
final class Response
{
    public static function json(bool $success, string $message, mixed $data = null, int $status = 200, ?array $errors = null): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        $body = ['success' => $success, 'message' => $message, 'data' => $data];
        if ($errors) $body['errors'] = $errors;
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        exit;
    }

    public static function ok(mixed $data = null, string $message = 'OK', int $status = 200): never
    {
        self::json(true, $message, $data, $status);
    }

    public static function created(mixed $data = null, string $message = 'Data berhasil dibuat'): never
    {
        self::json(true, $message, $data, 201);
    }

    public static function error(string $message, int $status = 400, ?array $errors = null): never
    {
        self::json(false, $message, null, $status, $errors);
    }
}
