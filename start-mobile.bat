@echo off
rem Menjalankan aplikasi (Expo). Scan QR yang muncul dengan Expo Go di HP.
rem IP laptop di mobile\.env diperbarui otomatis setiap kali file ini dijalankan.
title Mount Tracker - Expo (port 8081)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" -UpdateIp
cd /d "%~dp0mobile"
if not exist node_modules (
  echo node_modules belum ada. Jalankan setup.bat terlebih dahulu.
  pause
  exit /b 1
)
call npx expo start -c
pause
