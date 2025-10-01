#!/bin/bash

# Docker setup script for Unix/Linux/macOS
set -e

echo "🐳 Setting up BDI-Agent with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker compose plugin is available
if ! docker compose version &> /dev/null; then
    echo "❌ docker compose plugin is not available. Please update Docker Desktop or install the Docker Compose plugin."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start services
echo "🏗️ Building and starting services..."
if [ "$1" = "dev" ]; then
    echo "Starting in development mode..."
    docker compose -f docker-compose.dev.yml up --build -d
else
    echo "Starting in production mode..."
    docker compose up --build -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo "🌐 Application is available at: http://localhost:3000"
    echo "🗄️ MongoDB is available at: localhost:27017"
    echo ""
    echo "📋 Useful commands:"
    echo "  - View logs: docker compose logs -f"
    echo "  - Stop services: docker compose down"
    echo "  - View running containers: docker compose ps"
else
    echo "❌ Some services failed to start. Check logs with: docker compose logs"
    exit 1
fi