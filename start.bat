@echo off

echo 🚀 Starting BDI Robotic Arm Web Simulation...
echo ==============================================

:: Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo    Visit: https://docs.docker.com/get-docker/
    pause
    exit /b 1
)

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo ✅ Docker is ready

:: Build and start containers
echo 🏗️ Building and starting containers...
docker-compose up --build -d

if %errorlevel% equ 0 (
    echo ✅ Application started successfully!
    echo.
    echo 🌐 Access the application at: http://localhost
    echo 🔧 Backend API runs on: http://localhost:8080
    echo.
    echo To stop the application, run: docker-compose down
) else (
    echo ❌ Failed to start the application
    pause
    exit /b 1
)

pause
