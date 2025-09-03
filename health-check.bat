@echo off

echo 🏥 Health Check - BDI Agent Application
echo =======================================

:: Check if containers are running
echo 📦 Checking Docker containers...

for /f "tokens=*" %%i in ('docker ps --filter "name=bdi-backend" --format "{{.Status}}" 2^>nul') do set backend_status=%%i
for /f "tokens=*" %%i in ('docker ps --filter "name=bdi-frontend" --format "{{.Status}}" 2^>nul') do set frontend_status=%%i

if defined backend_status (
    echo ✅ Backend container: %backend_status%
) else (
    echo ❌ Backend container is not running
    pause
    exit /b 1
)

if defined frontend_status (
    echo ✅ Frontend container: %frontend_status%
) else (
    echo ❌ Frontend container is not running
    pause
    exit /b 1
)

echo.
echo 🌐 Checking service endpoints...

:: Check backend (simplified)
curl -s --connect-timeout 5 http://localhost:8080 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend service is responding on port 8080
) else (
    echo ❌ Backend service is not responding on port 8080
)

:: Check frontend
curl -s --connect-timeout 5 http://localhost >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend service is responding on port 80
) else (
    echo ❌ Frontend service is not responding on port 80
)

echo.
echo 🎉 Health check complete!
echo 🌐 Application should be accessible at: http://localhost

pause
