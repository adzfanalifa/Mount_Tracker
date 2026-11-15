<?php
declare(strict_types=1);

namespace App\Core;

use RuntimeException;

/** Error yang dikirim ke klien dengan kode HTTP dan pesan tertentu. */
final class HttpException extends RuntimeException
{
    public function __construct(string $message, private int $status = 400, private ?array $errors = null)
    {
        parent::__construct($message, $status);
    }

    public function status(): int { return $this->status; }
    public function errors(): ?array { return $this->errors; }

    public static function notFound(string $msg = 'Data tidak ditemukan'): self { return new self($msg, 404); }
    public static function unauthorized(string $msg = 'Silakan login terlebih dahulu'): self { return new self($msg, 401); }
    public static function forbidden(string $msg = 'Akses ditolak'): self { return new self($msg, 403); }
    public static function conflict(string $msg): self { return new self($msg, 409); }
    public static function validation(array $errors): self
    {
        return new self((string) reset($errors), 422, $errors);
    }
}
