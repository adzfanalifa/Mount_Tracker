<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/** Koneksi PDO tunggal + helper query dengan prepared statement. */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (!self::$pdo) {
            $c = App::config('db');
            $dsn = "mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset=utf8mb4";
            self::$pdo = new PDO($dsn, $c['user'], $c['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            // Samakan zona waktu MySQL dengan PHP agar TIMESTAMP konsisten.
            self::$pdo->exec("SET time_zone = '" . (new \DateTimeImmutable())->format('P') . "'");
        }
        return self::$pdo;
    }

    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st;
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $r = self::run($sql, $params)->fetch();
        return $r ?: null;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $v = self::run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** Insert dengan nama kolom dari kode (bukan dari input pengguna). */
    public static function insert(string $table, array $fields): int
    {
        $cols = array_keys($fields);
        $sql = sprintf('INSERT INTO `%s` (`%s`) VALUES (%s)', $table, implode('`,`', $cols),
            implode(',', array_map(fn($c) => ":$c", $cols)));
        self::run($sql, $fields);
        return (int) self::pdo()->lastInsertId();
    }

    public static function update(string $table, int $id, array $fields): void
    {
        if (!$fields) return;
        $set = implode(',', array_map(fn($c) => "`$c`=:$c", array_keys($fields)));
        $fields['__id'] = $id;
        self::run("UPDATE `$table` SET $set WHERE id=:__id", $fields);
    }

    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $r = $fn();
            $pdo->commit();
            return $r;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }
}
