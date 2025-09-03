#!/bin/bash

echo "🏥 Health Check - BDI Agent Application"
echo "======================================="

# Check if containers are running
echo "📦 Checking Docker containers..."
backend_status=$(docker ps --filter "name=bdi-backend" --format "{{.Status}}" | head -1)
frontend_status=$(docker ps --filter "name=bdi-frontend" --format "{{.Status}}" | head -1)

if [ -n "$backend_status" ]; then
    echo "✅ Backend container: $backend_status"
else
    echo "❌ Backend container is not running"
    exit 1
fi

if [ -n "$frontend_status" ]; then
    echo "✅ Frontend container: $frontend_status"
else
    echo "❌ Frontend container is not running"
    exit 1
fi

# Check if services are responding
echo ""
echo "🌐 Checking service endpoints..."

# Check backend WebSocket (simplified check)
if curl -s --connect-timeout 5 http://localhost:8080 > /dev/null; then
    echo "✅ Backend service is responding on port 8080"
else
    echo "❌ Backend service is not responding on port 8080"
fi

# Check frontend
if curl -s --connect-timeout 5 http://localhost > /dev/null; then
    echo "✅ Frontend service is responding on port 80"
else
    echo "❌ Frontend service is not responding on port 80"
fi

echo ""
echo "🎉 Health check complete!"
echo "🌐 Application should be accessible at: http://localhost"
