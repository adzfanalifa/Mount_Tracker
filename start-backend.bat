@echo off
rem Menjalankan backend Mount Tracker di port 8000 (bisa diakses HP di jaringan yang sama).
rem Pastikan Laragon sudah "Start All" (MySQL menyala). Jangan tutup jendela ini selama aplikasi dipakai.
title Mount Tracker - Backend (port 8000)
cd /d "%~dp0mount-tracker-backend"
set "PHP=php"
where php >nul 2>nul
if errorlevel 1 for /d %%D in ("C:\laragon\bin\php\*") do set "PHP=%%D\php.exe"
if not exist .env (
  echo File .env belum ada. Jalankan setup.bat terlebih dahulu.
  pause
  exit /b 1
)
echo Backend berjalan di http://0.0.0.0:8000  (tekan Ctrl+C untuk berhenti)
"%PHP%" -S 0.0.0.0:8000 -t public public/index.php
pause
