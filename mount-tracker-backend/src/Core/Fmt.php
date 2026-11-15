<?php
declare(strict_types=1);

namespace App\Core;

use DateTimeImmutable;

/** Helper format nilai DB -> JSON. */
final class Fmt
{
    public static function iso(?string $s): ?string
    {
        return $s ? (new DateTimeImmutable($s))->format('c') : null;
    }

    public static function sql(DateTimeImmutable $d): string
    {
        return $d->format('Y-m-d H:i:s');
    }

    public static function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    public static function float(mixed $v): ?float
    {
        return $v === null ? null : (float) $v;
    }

    public static function int(mixed $v): ?int
    {
        return $v === null ? null : (int) $v;
    }

    /** Escape karakter wildcard LIKE agar pencarian literal. */
    public static function like(string $s): string
    {
        return '%' . addcslashes($s, '%_\\') . '%';
    }
}
