@echo off

echo Starting BDI Blocks World Demo...
echo.

echo 1. Starting server...
cd backend
call npm install 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: npm install encountered issues
    echo Attempting to continue anyway...
    echo.
) else (
    echo.
    echo Dependencies installed successfully!
    echo.
)
start "BDI Server" cmd /k "node server.js"
echo.
timeout /t 3 /nobreak > nul
echo 2. Server started successfully!
echo - If you see errors, check the server window for details.
echo.

echo 3. Opening frontend in browser...
cd ..\frontend
start "" "main.html"
echo.

echo Demo is initiated!
echo - Server running in separate window
echo - Web page should open automatically
echo - Close server window when done
echo.
pause
