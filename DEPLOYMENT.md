# BDI-Agent Docker Deployment Guide

This guide provides quick deployment instructions for the BDI Blocks World application using Docker.

## Quick Start

### Prerequisites
- [Docker Desktop](https://docs.docker.com/get-docker/) installed and running
- Git (to clone the repository)

### Deploy with Docker

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CSIT321-BDI-Agent/BDI-Agent.git
   cd BDI-Agent
   ```

2. **Start the application:**
   
   **Windows:**
   ```cmd
   docker-setup.bat
   ```
   
   **macOS/Linux:**
   ```bash
   chmod +x docker-setup.sh
   ./docker-setup.sh
   ```

3. **Access the application:**
   - Web Interface: http://localhost:3000
   - MongoDB: localhost:27017
   - Health Check: http://localhost:3000/health

### Manual Docker Commands

```bash
# Production deployment
docker compose up --build -d

# Development with live reload
docker compose -f docker-compose.dev.yml up --build -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Node.js BDI application |
| `mongo` | 27017 | MongoDB database |

## Configuration

### Environment Variables

Create `.env` file for custom configuration:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo:27017/blocks_world
ALLOWED_ORIGINS=https://yourdomain.com
```

### Development Mode

For development with live file watching:
```bash
# Use development compose file
docker-compose -f docker-compose.dev.yml up --build -d
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Container Status
```bash
docker compose ps
```

### Application Logs
```bash
# All services
docker compose logs -f

# App only
docker compose logs -f app

# MongoDB only
docker compose logs -f mongo
```

### Planner Probe
```bash
curl -X POST http://localhost:3000/plan \
   -H "Content-Type: application/json" \
   -d '{"stacks":[["C"],["B","A"]],"goalChain":["A","B","C"]}'
```

## Database Operations

### Access MongoDB Shell
```bash
docker compose exec mongo mongosh blocks_world
```

### Database Backup
```bash
docker compose exec mongo mongodump --db blocks_world --out /tmp/backup
```

### Database Restore
```bash
docker compose exec mongo mongorestore --db blocks_world /tmp/backup/blocks_world
```

## Troubleshooting

### Common Issues

**Port 3000 already in use:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000
# Kill the process (replace PID)
taskkill /PID <PID> /F
```

**MongoDB connection issues:**
```bash
# Check MongoDB container
docker compose logs mongo

# Restart MongoDB
docker compose restart mongo
```

**Application not responding:**
```bash
# Check application logs
docker compose logs app

# Restart application
docker compose restart app
```

### Clean Reset
```bash
# Stop all containers and remove volumes
docker compose down -v

# Remove all Docker resources (careful!)
docker system prune -a
```

## Architecture

```
┌─────────────────────────────────────────┐
│                Browser                  │
│            localhost:3000               │
└─────────────────┬───────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────┐
│            Docker Host                  │
│  ┌─────────────────┐ ┌───────────────┐ │
│  │   App Container │ │ Mongo Container│ │
│  │    (Node.js)    │ │   (MongoDB)   │ │
│  │     :3000       │ │    :27017     │ │
│  └─────────┬───────┘ └───────▲───────┘ │
│            │                 │         │
│            └─────────────────┘         │
│              Internal Network          │
│               (bdi-network)            │
└─────────────────────────────────────────┘
```

## Additional Resources

- **Full Docker Documentation**: [DOCKER.md](./DOCKER.md)
- **Application README**: [README.md](./README.md)
- **Project Repository**: https://github.com/CSIT321-BDI-Agent/BDI-Agent

## Support

If you encounter issues:

1. Check the logs: `docker compose logs -f`
2. Verify services are running: `docker compose ps`
3. Check the health endpoint: `curl http://localhost:3000/health`
4. Refer to the troubleshooting section above

For more detailed deployment options and production configurations, see [DOCKER.md](./DOCKER.md).