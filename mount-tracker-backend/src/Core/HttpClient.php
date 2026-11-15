<?php
declare(strict_types=1);

namespace App\Core;

/** GET JSON ke layanan luar (Open-Meteo, Google). Memakai cURL jika ada. */
final class HttpClient
{
    public static function getJson(string $url, int $timeout = 8): array
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
                CURLOPT_USERAGENT => 'MountTrackerAPI/1.0',
            ]);
            $body = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);
            if ($body === false) throw new \RuntimeException("Gagal menghubungi layanan luar: $err");
        } else {
            $ctx = stream_context_create(['http' => ['timeout' => $timeout, 'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: MountTrackerAPI/1.0\r\n"]]);
            $body = @file_get_contents($url, false, $ctx);
            if ($body === false) throw new \RuntimeException('Gagal menghubungi layanan luar');
            $status = 200;
            foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int) $m[1];
        }
        $json = json_decode((string) $body, true);
        return ['status' => $status, 'json' => is_array($json) ? $json : null];
    }
}
