@echo off
REM ============================================================
REM  Energy Depot CRM — Gmail API setup & test
REM  Double-click this file or run: setup-gmail.bat
REM ============================================================

setlocal
cd /d "%~dp0backend"

echo.
echo ============================================================
echo   1. Instalando dependencias (npm install)
echo ============================================================
echo.
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install fallo. Revisa que Node.js este instalado.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   2. Probando envio con Service Account
echo   (impersonando gil.diaz@energydepotpr.com)
echo ============================================================
echo.
node test-gmail.js gil.diaz@energydepotpr.com gil.diaz@energydepotpr.com

echo.
echo ============================================================
echo  Listo. Revisa la bandeja de entrada de gil.diaz@energydepotpr.com
echo ============================================================
echo.
pause
