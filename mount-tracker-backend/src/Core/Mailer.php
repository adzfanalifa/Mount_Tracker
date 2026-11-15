<?php
declare(strict_types=1);

namespace App\Core;

use PHPMailer\PHPMailer\PHPMailer;

/**
 * Kirim email lewat SMTP memakai PHPMailer.
 * - Gmail: MAIL_HOST=smtp.gmail.com, MAIL_PORT=587, MAIL_ENCRYPTION=tls, MAIL_USERNAME + MAIL_PASSWORD (App Password).
 * - Tanpa MAIL_USERNAME: dikirim ke Mailpit lokal (Laragon) di 127.0.0.1:1025, lihat di http://localhost:8025.
 */
final class Mailer
{
    /** @return string 'smtp' | 'mailpit' (tujuan pengiriman) */
    public static function send(string $to, string $subject, string $html, string $text): string
    {
        if (!class_exists(PHPMailer::class)) {
            throw new \RuntimeException('PHPMailer belum terpasang. Jalankan "composer install" di folder backend.');
        }
        $c = App::config('mail');
        $useAuth = !empty($c['username']);
        $m = new PHPMailer(true);
        $m->isSMTP();
        $m->CharSet = 'UTF-8';
        $m->Timeout = 15;
        if ($useAuth) {
            $m->Host = $c['host'];
            $m->Port = (int) $c['port'];
            $m->SMTPAuth = true;
            $m->Username = $c['username'];
            $m->Password = (string) $c['password'];
            if ($c['encryption'] === 'ssl') $m->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            elseif ($c['encryption'] === 'tls') $m->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            // Mailpit: tanpa login dan tanpa enkripsi.
            $m->Host = $c['host'] ?: '127.0.0.1';
            $m->Port = (int) ($c['port'] ?: 1025);
            $m->SMTPAuth = false;
            $m->SMTPAutoTLS = false;
        }
        $from = $useAuth && str_contains((string) $c['host'], 'gmail') ? $c['username'] : $c['from'];
        $m->setFrom($from, $c['from_name']);
        $m->addAddress($to);
        $m->Subject = $subject;
        $m->isHTML(true);
        $m->Body = $html;
        $m->AltBody = $text;
        $m->send();
        return $useAuth ? 'smtp' : 'mailpit';
    }
}
