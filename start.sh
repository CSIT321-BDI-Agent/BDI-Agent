#!/bin/bash

echo "🚀 Starting BDI Robotic Arm Web Simulation..."
echo "=============================================="

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is ready"

# Build and start containers
echo "🏗️ Building and starting containers..."
docker-compose up --build -d

if [ $? -eq 0 ]; then
    echo "✅ Application started successfully!"
    echo ""
    echo "🌐 Access the application at: http://localhost"
    echo "🔧 Backend API runs on: http://localhost:8080"
    echo ""
    echo "To stop the application, run: docker-compose down"
else
    echo "❌ Failed to start the application"
    exit 1
fi
