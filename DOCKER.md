# Docker Setup for BDI-Agent

This document explains how to run the BDI Blocks World application using Docker and Docker Compose.

## Prerequisites

- **Docker**: [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose**: Usually included with Docker Desktop

## Quick Start

### Option 1: Using Setup Scripts

**Windows:**
```cmd
docker-setup.bat
```

**Unix/Linux/macOS:**
```bash
chmod +x docker-setup.sh
./docker-setup.sh
```

**Development Mode:**
```bash
./docker-setup.sh dev    # Unix/Linux/macOS
docker-setup.bat dev     # Windows
```

### Option 2: Manual Docker Compose

**Production:**
```bash
docker-compose up --build -d
```

**Development (with volume mounting):**
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

## Services

The application consists of two services:

### 1. App Service (`app`)
- **Image**: Built from local Dockerfile
- **Port**: 3000
- **Environment**: Node.js application server
- **Dependencies**: MongoDB service

### 2. MongoDB Service (`mongo`)
- **Image**: mongo:7.0
- **Port**: 27017
- **Database**: `blocks_world`
- **Initialization**: Runs `mongo-init.js` on first start

## Configuration

### Environment Variables

The application uses these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongo:27017/blocks_world` |

### Development vs Production

**Production Mode (`docker-compose.yml`):**
- Optimized for deployment
- No volume mounting
- Production environment variables

**Development Mode (`docker-compose.dev.yml`):**
- Source code volume mounted for live editing
- Development environment variables
- Separate MongoDB data volume

## Data Persistence

MongoDB data is persisted using Docker volumes:
- **Production**: `mongo_data`
- **Development**: `mongo_data_dev`

## Useful Commands

### Container Management
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View running containers
docker-compose ps
```

### Logs and Debugging
```bash
# View all logs
docker-compose logs -f

# View app logs only
docker-compose logs -f app

# View MongoDB logs only
docker-compose logs -f mongo

# Execute commands in app container
docker-compose exec app sh

# Execute commands in MongoDB container
docker-compose exec mongo mongosh blocks_world
```

### Database Operations
```bash
# Connect to MongoDB shell
docker-compose exec mongo mongosh blocks_world

# Backup database
docker-compose exec mongo mongodump --db blocks_world --out /tmp/backup

# Import database
docker-compose exec mongo mongorestore --db blocks_world /tmp/backup/blocks_world
```

### Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a
```

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000   # Windows (then kill PID)
```

**MongoDB Connection Issues:**
```bash
# Check MongoDB container status
docker-compose logs mongo

# Verify network connectivity
docker-compose exec app ping mongo
```

**Application Not Starting:**
```bash
# Check application logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env
```

### Health Checks

The application includes health checks:
```bash
# Check container health
docker-compose ps

# Manual health check
curl http://localhost:3000
```

## Network Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Host System   │    │  Docker Network │
│                 │    │   (bdi-network) │
│  localhost:3000 │◄──►│                 │
│  localhost:27017│◄──►│   app:3000      │
└─────────────────┘    │   mongo:27017   │
                       └─────────────────┘
```

## Security Considerations

- MongoDB is accessible only within Docker network by default
- Application runs as non-root user (`nodejs`)
- Sensitive data should use environment variables
- For production, consider adding SSL/TLS termination

## Performance Tuning

### Resource Limits
Add to `docker-compose.yml`:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### MongoDB Optimization
```yaml
services:
  mongo:
    command: mongod --wiredTigerCacheSizeGB 0.5
```

## Production Deployment

For production deployment:

1. Use `docker-compose.yml` (not dev version)
2. Set proper environment variables
3. Configure reverse proxy (nginx/traefik)
4. Enable MongoDB authentication
5. Set up SSL certificates
6. Configure backup strategies

Example nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```