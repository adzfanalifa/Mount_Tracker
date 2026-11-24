# Mount Tracker - setup otomatis untuk Windows + Laragon.
# Jalankan lewat setup.bat (klik dua kali). Aman dijalankan berulang kali.
#   setup.bat            -> setup lengkap (backend .env, database, mobile .env, npm install)
#   setup.bat -UpdateIp  -> hanya memperbarui IP laptop di mobile\.env
param([switch]$UpdateIp)

$ErrorActionPreference = 'Continue' # hasil perintah dicek manual lewat $LASTEXITCODE
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$be = Join-Path $root 'mount-tracker-backend'
$mo = Join-Path $root 'mobile'
$laragon = if ($env:LARAGON_ROOT) { $env:LARAGON_ROOT } else { 'C:\laragon' }

function Step($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "   OK  $t" -ForegroundColor Green }
function Warn($t) { Write-Host "   !!  $t" -ForegroundColor Yellow }

function Find-Exe($cmd, $patterns) {
  $c = Get-Command $cmd -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source }
  foreach ($p in $patterns) {
    $f = Get-ChildItem $p -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($f) { return $f.FullName }
  }
  return $null
}

function Write-Utf8($path, $text) { [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($false))) }

function Get-LanIp {
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127|169\.254)\.' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback|WSL|Bluetooth' }
  $wifi = $ips | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|WLAN' } | Select-Object -First 1
  if ($wifi) { return $wifi.IPAddress }
  $any = $ips | Select-Object -First 1
  if ($any) { return $any.IPAddress }
  return '127.0.0.1'
}

function Update-MobileEnv {
  $ip = Get-LanIp
  $url = "http://${ip}:8000"
  $envFile = Join-Path $mo '.env'
  $src = if (Test-Path $envFile) { $envFile } else { Join-Path $mo '.env.example' }
  $text = [IO.File]::ReadAllText($src)
  $text = [regex]::Replace($text, '(?m)^EXPO_PUBLIC_API_URL=.*$', "EXPO_PUBLIC_API_URL=$url")
  Write-Utf8 $envFile $text
  Ok "mobile\.env -> EXPO_PUBLIC_API_URL=$url"
  return $url
}

if ($UpdateIp) { Update-MobileEnv | Out-Null; exit 0 }

Write-Host 'Mount Tracker - setup' -ForegroundColor White

# ------------------------------------------------------------ alat
Step 'Mencari PHP, MySQL, dan Node.js'
$php = Find-Exe 'php' @("$laragon\bin\php\*\php.exe")
$mysql = Find-Exe 'mysql' @("$laragon\bin\mysql\*\bin\mysql.exe")
$mysqldump = if ($mysql) { Join-Path (Split-Path $mysql) 'mysqldump.exe' } else { $null }
$npm = Find-Exe 'npm.cmd' @("$laragon\bin\nodejs\*\npm.cmd", "$env:ProgramFiles\nodejs\npm.cmd")
if (-not $php) { Warn 'PHP tidak ditemukan. Install Laragon (https://laragon.org) lalu jalankan ulang setup.'; exit 1 }
Ok "PHP   : $php"
if ($mysql) { Ok "MySQL : $mysql" } else { Warn 'MySQL tidak ditemukan (langkah database dilewati).' }
if ($npm) { Ok "npm   : $npm" } else { Warn 'Node.js/npm tidak ditemukan (npm install dilewati). Install Node.js 20+.' }

# ------------------------------------------------------------ backend .env
Step 'Backend: file .env'
$beEnv = Join-Path $be '.env'
if (Test-Path $beEnv) {
  Ok '.env sudah ada (tidak diubah)'
} else {
  $secret = (& $php -r "echo bin2hex(random_bytes(32));").Trim()
  $text = [IO.File]::ReadAllText((Join-Path $be '.env.example'))
  $text = [regex]::Replace($text, '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$secret")
  Write-Utf8 $beEnv $text
  Ok '.env dibuat dari .env.example dengan JWT_SECRET acak'
}

# ------------------------------------------------------------ backend vendor
Step 'Backend: library PHP (vendor)'
if (Test-Path (Join-Path $be 'vendor\autoload.php')) {
  Ok 'vendor sudah ada'
} else {
  $composer = Find-Exe 'composer.phar' @("$laragon\bin\composer\composer.phar")
  if ($composer) {
    Push-Location $be; & $php -d extension=zip $composer install --no-interaction; Pop-Location
    Ok 'composer install selesai'
  } else { Warn 'vendor tidak ada dan Composer tidak ditemukan. Jalankan "composer install" di folder backend.' }
}

# ------------------------------------------------------------ database
Step 'Database: mount_tracker'
if ($mysql) {
  & $mysql -uroot -e 'SELECT 1' *> $null
  if ($LASTEXITCODE -ne 0) {
    Warn 'MySQL belum berjalan. Buka Laragon, klik "Start All", lalu jalankan setup.bat lagi.'
  } else {
    $exists = (& $mysql -uroot -N -e "SHOW DATABASES LIKE 'mount_tracker'") -ne $null
    $doImport = $true
    if ($exists) {
      $ans = Read-Host '   Database mount_tracker sudah ada. Hapus dan isi ulang dengan data awal? (y/N)'
      $doImport = $ans -match '^[yY]'
      if ($doImport -and (Test-Path $mysqldump)) {
        $bk = Join-Path $be 'database\backup'
        New-Item -ItemType Directory -Force $bk | Out-Null
        $file = Join-Path $bk ('mount_tracker-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
        & $mysqldump -uroot --databases mount_tracker "--result-file=$file"
        Ok "Backup database lama: $file"
      }
    }
    if ($doImport) {
      foreach ($f in 'schema.sql', 'seed.sql') {
        $sql = Join-Path $be "database\$f"
        cmd /c "`"$mysql`" -uroot --default-character-set=utf8mb4 < `"$sql`""
        if ($LASTEXITCODE -ne 0) { Warn "Gagal mengimpor $f"; exit 1 }
      }
      Ok 'schema.sql + seed.sql berhasil diimpor (akun demo: demo / demo1234)'
    } else { Ok 'Database lama dipakai (tidak diubah)' }
  }
}

# ------------------------------------------------------------ mobile
Step 'Mobile: file .env dan library'
$url = Update-MobileEnv
if ($npm) {
  if (Test-Path (Join-Path $mo 'node_modules\expo')) { Ok 'node_modules sudah ada' }
  else {
    Write-Host '   npm install (beberapa menit)...'
    Push-Location $mo; & $npm install --no-audit --no-fund; $code = $LASTEXITCODE; Pop-Location
    if ($code -eq 0) { Ok 'npm install selesai' } else { Warn 'npm install gagal, cek koneksi internet lalu ulangi.' }
  }
}

# ------------------------------------------------------------ firewall
Step 'Firewall (agar HP bisa mengakses laptop)'
$rule = Get-NetFirewallRule -Direction Inbound -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'Mount Tracker*' -and $_.Enabled -eq 'True' }
if ($rule) { Ok 'Aturan firewall Mount Tracker sudah ada' }
else {
  netsh advfirewall firewall add rule name="Mount Tracker" dir=in action=allow protocol=TCP localport=8000,8081 profile=any *> $null
  if ($LASTEXITCODE -eq 0) { Ok 'Aturan firewall ditambahkan' }
  else { Warn 'Butuh hak Administrator. Klik kanan setup.bat -> "Run as administrator" sekali saja untuk membuka port 8000 & 8081.' }
}

Write-Host ''
Write-Host 'Selesai. Langkah berikutnya:' -ForegroundColor White
Write-Host '  1. Pastikan Laragon "Start All" (MySQL hijau).'
Write-Host '  2. Klik dua kali start-backend.bat   (jangan ditutup)'
Write-Host '  3. Klik dua kali start-mobile.bat    (scan QR dengan Expo Go)'
Write-Host "  4. Cek dari browser HP: $url/   -> harus muncul success:true"
Write-Host '  Login demo: demo / demo1234'
