@echo off
title GALACTICA: VIPER STRIKE - Arcade Hub (Port 8088)
cd /d "%~dp0"

echo ======================================================
echo    GALACTICA: VIPER STRIKE - Battlestar x Phoenix
echo ======================================================
echo.
echo A iniciar o servidor na porta 8088...
echo.

start http://localhost:8088

python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); (s.connect(('8.8.8.8', 80)), print(' - No teu telemovel (mesmo Wi-Fi), acede a:\n   http://' + s.getsockname()[0] + ':8088\n'), s.close()) if True else None" 2>nul

echo  - No teu computador:
echo    http://localhost:8088
echo.
echo ======================================================
echo Pressiona Ctrl + C para encerrar o servidor.
echo ======================================================
echo.

python -m http.server 8088

echo.
echo O servidor foi interrompido.
pause
