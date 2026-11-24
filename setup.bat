@echo off
rem Setup otomatis Mount Tracker (Windows + Laragon). Klik dua kali file ini.
rem Klik kanan -> Run as administrator (sekali saja) agar firewall port 8000 & 8081 ikut dibuka.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
pause
