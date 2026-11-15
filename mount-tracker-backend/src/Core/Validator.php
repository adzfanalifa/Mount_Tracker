<?php
declare(strict_types=1);

namespace App\Core;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Validasi input. Setiap aturan mengisi $clean (nilai yang sudah dibersihkan)
 * atau $errors. Panggil validate() di akhir: melempar 422 jika ada error.
 * Field opsional yang tidak dikirim tidak dimasukkan ke hasil.
 */
final class Validator
{
    private array $errors = [];
    private array $clean = [];

    public function __construct(private array $data) {}

    private function present(string $k): bool
    {
        return array_key_exists($k, $this->data) && $this->data[$k] !== null && $this->data[$k] !== '';
    }

    private function missing(string $k, bool $required, string $label): bool
    {
        if ($this->present($k)) return false;
        if ($required) $this->errors[$k] = "$label wajib diisi";
        return true;
    }

    public function string(string $k, string $label, bool $required = false, int $min = 0, int $max = 255, ?string $pattern = null, ?string $patternMsg = null): self
    {
        if ($this->missing($k, $required, $label)) return $this;
        $v = $this->data[$k];
        if (!is_scalar($v)) { $this->errors[$k] = "$label tidak valid"; return $this; }
        $v = trim((string) $v);
        $len = mb_strlen($v);
        if ($len < $min) $this->errors[$k] = "$label minimal $min karakter";
        elseif ($len > $max) $this->errors[$k] = "$label maksimal $max karakter";
        elseif ($pattern && !preg_match($pattern, $v)) $this->errors[$k] = $patternMsg ?? "$label tidak valid";
        else $this->clean[$k] = $v;
        return $this;
    }

    public function email(string $k, string $label = 'Email', bool $required = false): self
    {
        if ($this->missing($k, $required, $label)) return $this;
        $v = strtolower(trim((string) $this->data[$k]));
        if (!filter_var($v, FILTER_VALIDATE_EMAIL) || strlen($v) > 150) $this->errors[$k] = 'Format email tidak valid';
        else $this->clean[$k] = $v;
        return $this;
    }

    public function int(string $k, string $label, bool $required = false, ?int $min = null, ?int $max = null): self
    {
        if ($this->missing($k, $required, $label)) return $this;
        $v = filter_var($this->data[$k], FILTER_VALIDATE_INT);
        if ($v === false) $this->errors[$k] = "$label harus berupa angka bulat";
        elseif ($min !== null && $v < $min) $this->errors[$k] = "$label minimal $min";
        elseif ($max !== null && $v > $max) $this->errors[$k] = "$label maksimal $max";
        else $this->clean[$k] = $v;
        return $this;
    }

    public function number(string $k, string $label, bool $required = false, ?float $min = null, ?float $max = null): self
    {
        if ($this->missing($k, $required, $label)) return $this;
        $v = $this->data[$k];
        if (!is_numeric($v)) { $this->errors[$k] = "$label harus berupa angka"; return $this; }
        $v = (float) $v;
        if ($min !== null && $v < $min) $this->errors[$k] = "$label minimal $min";
        elseif ($max !== null && $v > $max) $this->errors[$k] = "$label maksimal $max";
        else $this->clean[$k] = $v;
        return $this;
    }

    public function enum(string $k, string $label, array $allowed, bool $required = false): self
    {
        if ($this->missing($k, $required, $label)) return $this;
        $v = $this->data[$k];
        if (!in_array($v, $allowed, true)) $this->errors[$k] = "$label harus salah satu dari: " . implode(', ', $allowed);
        else $this->clean[$k] = $v;
        return $this;
    }

    public function bool(string $k): self
    {
        if (array_key_exists($k, $this->data)) {
            $this->clean[$k] = filter_var($this->data[$k], FILTER_VALIDATE_BOOLEAN);
        }
        return $this;
    }

    public function datetime(string $k, string $label, bool $required = false): self
    {
        if ($this->missing($k, $required, $label)) return $this;
        $d = self::parseDate($this->data[$k]);
        if (!$d) $this->errors[$k] = "$label harus berupa tanggal/waktu yang valid (ISO 8601)";
        else $this->clean[$k] = $d;
        return $this;
    }

    /** Tambahkan error manual (validasi lintas field). */
    public function fail(string $k, string $msg): self
    {
        $this->errors[$k] ??= $msg;
        return $this;
    }

    public function validate(): array
    {
        if ($this->errors) throw HttpException::validation($this->errors);
        return $this->clean;
    }

    public static function parseDate(mixed $v): ?DateTimeImmutable
    {
        if (!is_string($v) || trim($v) === '') return null;
        try {
            return (new DateTimeImmutable($v))->setTimezone(new DateTimeZone(date_default_timezone_get()));
        } catch (\Throwable) {
            return null;
        }
    }
}
