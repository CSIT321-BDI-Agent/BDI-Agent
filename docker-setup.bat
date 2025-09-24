@echo off
REM Docker setup script for Windows

echo 🐳 Setting up BDI-Agent with Docker...

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down 2>nul

REM Build and start services
echo 🏗️ Building and starting services...
if "%1"=="dev" (
    echo Starting in development mode...
    docker-compose -f docker-compose.dev.yml up --build -d
) else (
    echo Starting in production mode...
    docker-compose up --build -d
)

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check if services are running
docker-compose ps | find "Up" >nul
if errorlevel 1 (
    echo ❌ Some services failed to start. Check logs with: docker-compose logs
    pause
    exit /b 1
) else (
    echo ✅ Services are running!
    echo 🌐 Application is available at: http://localhost:3000
    echo 🗄️ MongoDB is available at: localhost:27017
    echo.
    echo 📋 Useful commands:
    echo   - View logs: docker-compose logs -f
    echo   - Stop services: docker-compose down
    echo   - View running containers: docker-compose ps
)

pause