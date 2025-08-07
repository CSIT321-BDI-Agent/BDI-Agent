#!/bin/bash

echo "========================================"
echo "   BDI Blocks World Demo Launcher"
echo "========================================"
echo

echo "1. Starting server..."
cd backend

echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo
    echo "WARNING: npm install encountered issues"
    echo "Attempting to continue anyway..."
    echo
else
    echo
    echo "Dependencies installed successfully!"
    echo
fi

echo "Starting BDI Server..."
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && echo \"Starting BDI Server...\" && node server.js"'
echo

echo "2. Waiting for server to start..."
sleep 5
echo "Server started successfully!"
echo "- If you see errors, check the server terminal window for details."
echo

echo "3. Opening frontend in browser..."
cd ../frontend

# Try to open with default browser
if [ -f "main.html" ]; then
    open "main.html"
    echo "Frontend opened from frontend folder"
else
    echo "ERROR: main.html not found in frontend folder"
    exit 1
fi

echo
echo "========================================"
echo "   Demo Started Successfully!"
echo "========================================"
echo "- Server running in separate terminal window"
echo "- Web page should open automatically"
echo "- Close server terminal when done"
echo
echo "Press any key to exit this launcher..."
read -n 1 -s