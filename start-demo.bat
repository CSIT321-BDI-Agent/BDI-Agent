@echo off
echo Starting BDI Blocks World Demo...
echo.
echo 1. Starting server...
start "BDI Server" cmd /k "node server.js"
echo.
echo 2. Waiting for server to start...
timeout /t 3 /nobreak > nul
echo.
echo 3. Opening demo in browser...
start "" "main.html"
echo.
echo Demo is starting! 
echo - Server running in separate window
echo - Web page should open automatically
echo - Close server window when done
echo.
pause
