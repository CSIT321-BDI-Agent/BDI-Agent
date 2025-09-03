# BDI Robotic Arm Web Simulation

This project simulates a robotic arm using a BDI agent in Node.js and a frontend in HTML/JS.

## 🚀 Quick Start (Docker - Recommended)

### Prerequisites
- Docker Desktop installed and running
- Download from: https://docs.docker.com/get-docker/

### Option 1: Automated Start
**Windows:**
```bash
./start.bat
```

**macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual Docker Commands
```bash
# Start the application
docker-compose up --build -d

# Stop the application
docker-compose down

# View logs
docker-compose logs -f
```

### Option 3: Development Mode (with file watching)
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

After starting, access the application at: **http://localhost**

## 🛠️ Development Setup (Without Docker)

### Prerequisites
- Node.js (https://nodejs.org/en/download)

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
Serve the frontend directory with any web server, or open `frontend/main.html` in a browser.

## 📋 Project Structure

```
BDI-Agent/
├── backend/                 # Node.js WebSocket server
│   ├── agent/              # BDI agent logic
│   ├── Dockerfile          # Backend container config
│   ├── package.json        # Node.js dependencies
│   └── server.js           # Main server file
├── frontend/               # HTML/JS client
│   ├── Dockerfile          # Frontend container config
│   ├── nginx.conf          # Nginx configuration
│   ├── main.html           # Main application page
│   └── script.js           # Client-side logic
├── docker-compose.yml      # Production containers
├── docker-compose.dev.yml  # Development containers
└── start.bat / start.sh    # Automated startup scripts
```

## ✨ Features

- BDI (Belief-Desire-Intention) agent simulation
- Real-time WebSocket communication
- Interactive robotic arm visualization
- Block stacking goals and plan execution
- Fully containerized with Docker
- Cross-platform deployment

## 🔧 Container Architecture

- **Backend Container**: Node.js server with WebSocket support (Port 8080)
- **Frontend Container**: Nginx serving static files with WebSocket proxy (Port 80)
- **Network**: Private Docker network for inter-container communication

## 📝 Usage

1. Open the application at http://localhost
2. Add blocks using the "Add Block" button
3. Enter goals like "A on B" to stack blocks
4. Watch the robotic arm execute the plan in real-time

