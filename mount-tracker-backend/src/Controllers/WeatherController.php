<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\HttpClient;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Mountain;

/** Perantara ke Open-Meteo (tanpa API key), hasil di-cache beberapa menit. */
final class WeatherController
{
    /** Kode cuaca WMO -> [deskripsi, ikon Ionicons]. */
    private const CODES = [
        0 => ['Cerah', 'sunny'], 1 => ['Cerah berawan', 'partly-sunny'], 2 => ['Berawan sebagian', 'partly-sunny'],
        3 => ['Mendung', 'cloudy'], 45 => ['Berkabut', 'cloudy'], 48 => ['Kabut beku', 'cloudy'],
        51 => ['Gerimis ringan', 'rainy'], 53 => ['Gerimis', 'rainy'], 55 => ['Gerimis lebat', 'rainy'],
        56 => ['Gerimis beku', 'rainy'], 57 => ['Gerimis beku lebat', 'rainy'],
        61 => ['Hujan ringan', 'rainy'], 63 => ['Hujan', 'rainy'], 65 => ['Hujan lebat', 'rainy'],
        66 => ['Hujan beku', 'rainy'], 67 => ['Hujan beku lebat', 'rainy'],
        71 => ['Salju ringan', 'snow'], 73 => ['Salju', 'snow'], 75 => ['Salju lebat', 'snow'], 77 => ['Butiran salju', 'snow'],
        80 => ['Hujan lokal', 'rainy'], 81 => ['Hujan lokal sedang', 'rainy'], 82 => ['Hujan lokal deras', 'thunderstorm'],
        85 => ['Salju lokal', 'snow'], 86 => ['Salju lokal lebat', 'snow'],
        95 => ['Badai petir', 'thunderstorm'], 96 => ['Badai petir + es', 'thunderstorm'], 99 => ['Badai petir + es lebat', 'thunderstorm'],
    ];

    private static function describe(?int $code): array
    {
        [$d, $i] = self::CODES[$code ?? -1] ?? ['Tidak diketahui', 'cloud-outline'];
        return ['weatherCode' => $code, 'description' => $d, 'icon' => $i];
    }

    /** GET /weather?lat=&lng=&hours=  atau  /weather?mountainId= */
    public function hourly(Request $r): void
    {
        $f = (new Validator($_GET))
            ->number('lat', 'Latitude', false, -90, 90)
            ->number('lng', 'Longitude', false, -180, 180)
            ->int('mountainId', 'Gunung', false, 1)
            ->int('hours', 'Jumlah jam', false, 1, 48)
            ->validate();
        $hours = $f['hours'] ?? 24;
        if (isset($f['mountainId'])) {
            $m = Mountain::find($f['mountainId']) ?? throw HttpException::notFound('Gunung tidak ditemukan');
            if ($m['latitude'] === null) throw new HttpException('Koordinat gunung belum diisi', 422);
            [$lat, $lng] = [(float) $m['latitude'], (float) $m['longitude']];
        } elseif (isset($f['lat'], $f['lng'])) {
            [$lat, $lng] = [$f['lat'], $f['lng']];
        } else {
            throw HttpException::validation(['lat' => 'Isi lat & lng, atau mountainId']);
        }

        $raw = $this->fetch(round($lat, 3), round($lng, 3));
        $h = $raw['hourly'] ?? [];
        $times = $h['time'] ?? [];
        $nowHour = date('Y-m-d\TH:00');
        $start = 0;
        foreach ($times as $i => $t) { if ($t >= $nowHour) { $start = $i; break; } }
        $items = [];
        for ($i = $start; $i < min(count($times), $start + $hours); $i++) {
            $items[] = [
                'time' => $times[$i],
                'temperatureC' => $h['temperature_2m'][$i] ?? null,
                'humidity' => $h['relative_humidity_2m'][$i] ?? null,
                'precipitationProbability' => $h['precipitation_probability'][$i] ?? null,
                'windKmh' => $h['wind_speed_10m'][$i] ?? null,
            ] + self::describe(isset($h['weather_code'][$i]) ? (int) $h['weather_code'][$i] : null);
        }
        $c = $raw['current'] ?? [];
        Response::ok([
            'latitude' => $lat,
            'longitude' => $lng,
            'elevation' => $raw['elevation'] ?? null,
            'timezone' => $raw['timezone'] ?? null,
            'current' => $c ? [
                'time' => $c['time'] ?? null,
                'temperatureC' => $c['temperature_2m'] ?? null,
                'humidity' => $c['relative_humidity_2m'] ?? null,
                'windKmh' => $c['wind_speed_10m'] ?? null,
            ] + self::describe(isset($c['weather_code']) ? (int) $c['weather_code'] : null) : null,
            'hourly' => $items,
            'source' => 'Open-Meteo',
        ]);
    }

    private function fetch(float $lat, float $lng): array
    {
        $dir = App::basePath('storage/cache');
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $file = $dir . "/weather_{$lat}_{$lng}.json";
        $ttl = (int) App::config('weather.cache_ttl', 900);
        if (is_file($file) && time() - filemtime($file) < $ttl) {
            $cached = json_decode((string) file_get_contents($file), true);
            if (is_array($cached)) return $cached;
        }
        $url = App::config('weather.base_url') . '?' . http_build_query([
            'latitude' => $lat, 'longitude' => $lng,
            'hourly' => 'temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m',
            'current' => 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
            'timezone' => App::config('timezone'), 'forecast_days' => 3,
        ]);
        try {
            $res = HttpClient::getJson($url);
        } catch (\Throwable $e) {
            if (is_file($file)) return json_decode((string) file_get_contents($file), true) ?: [];
            throw new HttpException('Layanan cuaca tidak dapat dihubungi. Periksa koneksi internet server.', 502);
        }
        if ($res['status'] !== 200 || !$res['json']) {
            throw new HttpException('Layanan cuaca sedang bermasalah: ' . ($res['json']['reason'] ?? 'HTTP ' . $res['status']), 502);
        }
        @file_put_contents($file, json_encode($res['json']));
        return $res['json'];
    }
}
