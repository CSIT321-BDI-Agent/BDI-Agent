# BDI-Agent: Blocks World Simulation

A classic AI environment implementing **BDI (Belief-Desire-Intention) planning** for manipulating colored blocks to achieve goal configurations. The current release integrates the [JS-son](https://github.com/TimKam/JS-son) BDI framework to generate plans server-side and animate them through an interactive web-based blocks world simulator.

## Features

- **Interactive Blocks World**: Drag-and-drop interface for creating block configurations
- **JS-son BDI Planning**: Server-side plan synthesis using a JS-son agent with explicit beliefs, desires, and intentions
- **Visual Animation System**: Smooth CSS transitions with robotic claw visualization
- **User Authentication**: Secure user accounts with bcrypt password hashing
- **World Persistence**: Save and load block configurations per user
- **Real-time Planning**: Watch the AI agent execute step-by-step plans to achieve goals

## Architecture

**Backend**: Node.js + Express + MongoDB + JS-son BDI agent
- RESTful API for user authentication, BDI planning (`POST /plan`), and world persistence
- `bdi/blocksWorldAgent.js` wraps a JS-son agent that interprets world state beliefs and synthesizes plans
- Mongoose ODM for database operations
- bcrypt for secure password hashing

**Frontend**: Vanilla JavaScript + HTML5 + CSS3
- No build process - direct file editing and browser refresh
- Embedded CSS and JavaScript for simplicity
- Calls the `/plan` endpoint to request JS-son generated move sequences
- Responsive design with modern UI components

## Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/CSIT321-BDI-Agent/BDI-Agent.git
cd BDI-Agent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up MongoDB
**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod --dbpath /path/to/your/db
```

**Option B: MongoDB Atlas (Cloud)**
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster and get your connection string
3. Create a `.env` file in the project root:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/blocks_world
PORT=3000
```

### 4. Start the Application
```bash
node server.js
```

The server will start on `http://localhost:3000`

### Docker Quick Start

The repository includes a production-ready Docker setup. To run the stack with MongoDB locally:

```bash
docker compose up --build
```

For development with live reload, use:

```bash
docker compose -f docker-compose.dev.yml up --build
```

See the **Docker Deployment** section below for complete details.

## Usage

### Getting Started
1. **Create an Account**: Navigate to the signup page and create a new user account
2. **Add Blocks**: Use the "Add Block" feature to create blocks (single letters A-Z)
3. **Set Goals**: Enter a goal configuration like "A on B on C"
4. **Watch Planning**: Click "Start Simulation" to send the request to the JS-son BDI planner and watch the returned moves animate
5. **Save Worlds**: Save interesting configurations for later use

### Goal Syntax
Goals are specified in natural language format:
- `A on B` - Places block A on top of block B
- `A on B on C` - Creates a stack with C at bottom, B in middle, A on top
- Case-insensitive, separated by "on" keyword

### Planning Algorithm
Planning is handled server-side by a JS-son BDI agent:
- The frontend sends the current stacks and parsed goal chain to `POST /plan`.
- The agent maintains beliefs about stack configuration, forms the desire to satisfy each relation in the goal chain, and derives intentions via JS-son preference logic.
- Plans contain actions such as clearing blockers or stacking a block on its target; each action is returned as `{ "block": "A", "to": "B" }` move descriptors.
- The client animates the returned sequence while displaying metadata (iterations, number of relations resolved).

## Development

### Project Structure
```
BDI-Agent/
├── bdi/                      # JS-son agent and planning utilities
│   ├── blocksWorldAgent.js   # BDI planner implementation
│   └── utils/
│       └── blocks.js         # Planner helper functions
├── models/                   # MongoDB schemas
│   ├── User.js               # User authentication schema
│   └── World.js              # Block world persistence schema
├── utils/                    # Reusable server utilities
│   ├── database.js           # MongoDB connection with retry logic
│   ├── httpError.js          # HTTP error class
│   ├── routeHandler.js       # Route error handling wrapper
│   └── validators.js         # Input validation helpers
├── public/                   # Static frontend files
│   ├── config.js             # Frontend configuration
│   ├── index.html            # Main simulation interface
│   ├── login.html            # User authentication
│   ├── signup.html           # User registration
│   ├── script.js             # Core simulation engine
│   ├── style.css             # Styling and animations
│   └── debug.html            # Debug utilities
├── server.js                 # Express server and API routes
├── planner-debug.js          # Planner regression test suite
├── package.json              # Dependencies and project metadata
├── Dockerfile                # Container definition
├── docker-compose.yml        # Production Docker setup
├── docker-compose.dev.yml    # Development Docker setup
└── .github/
    └── copilot-instructions.md  # AI coding guidelines
```

### Code Organization

The codebase follows a modular architecture with clear separation of concerns:

**Utilities Layer** (`utils/`):
- Centralized error handling, validation, and database connection logic
- Reusable across routes without duplication
- Isolated for independent testing

**Models Layer** (`models/`):
- Mongoose schemas separated from business logic
- Clean data layer abstraction
- Easy to extend with new collections

**BDI Layer** (`bdi/`):
- JS-son agent implementation
- Planning algorithms and block world helpers
- Independent of web server concerns

**Benefits**:
- **Maintainability**: Single responsibility per module
- **Testability**: Isolated components can be unit tested
- **Scalability**: Easy to add new routes, models, or utilities
- **Code Reusability**: Validation and error handling centralized

### API Endpoints
- `POST /users/signup` - User registration with bcrypt hashing
- `POST /login` - User authentication
- `POST /worlds` - Save world configuration (requires authentication)
- `GET /worlds` - List all saved worlds for authenticated user
- `GET /worlds/:id?userId=` - Load specific world
- `POST /plan` - Generate a JS-son BDI plan for the provided stacks/goal
- `GET /health` - Docker health check endpoint
- Static files served from `/public`

### Dependencies

All packages are necessary and actively used:

| Package | Version | Purpose |
|---------|---------|---------|
| `bcrypt` | ^6.0.0 | User password hashing |
| `cors` | ^2.8.5 | CORS handling for API security |
| `dotenv` | ^17.2.2 | Environment variable management |
| `express` | ^5.1.0 | Web server framework |
| `js-son-agent` | ^0.0.17 | BDI agent framework (core planner) |
| `mongoose` | ^8.18.1 | MongoDB ODM for persistence |

### Development Workflow
1. **Backend Changes**: Edit `server.js` or files in `utils/`, `models/` and restart with `node server.js`
2. **Frontend Changes**: Edit files in `public/` and refresh browser
3. **Database**: MongoDB collections: `users` and `worlds`
4. **Testing**: Run `npm run test:planner` after planner changes

### Recent Improvements

**Code Organization** (October 2025):
- Reduced `server.js` from 350 to 183 lines (48% reduction)
- Created modular `utils/` directory for reusable server utilities
- Created `models/` directory for Mongoose schemas
- Centralized error handling, validation, and database connection logic
- Improved code reusability and testability

**Enhanced Test Coverage**:
- Expanded test suite from 5 to 11 scenarios (120% increase)
- Added 6 negative test cases for error validation
- Validates duplicate detection, unknown blocks, invalid goals, type checking
- Confirmed zero false positives through meta-testing
- All assertions strictly validated

### Environment Variables
```env
PORT=3000                                    # Server port (default: 3000)
MONGODB_URI=mongodb://localhost:27017/blocks_world  # Database connection
```

When running under Docker, environment variables are provided via the compose files. Override them using an `.env` file or compose overrides as needed.

## Troubleshooting

### Common Issues

**Server won't start**
- Check if MongoDB is running: `mongod --version`
- Verify port 3000 is available: `netstat -an | findstr 3000`

**Cannot save worlds**
- Ensure you're logged in (check browser localStorage)
- Verify MongoDB connection in server logs

**Blocks won't move**
- Check browser console for JavaScript errors
- Ensure goal syntax is correct (e.g., "A on B on C")

**Authentication fails**
- Clear browser localStorage: `localStorage.clear()`
- Check MongoDB users collection exists

### Known Issues
- The application currently lacks automated tests. Follow the manual workflow below until a test suite is added.
- MongoDB authentication is disabled by default. Enable it and update connection strings before deploying to shared infrastructure.
- The frontend assumes the API is reachable at the same origin or via the `API_BASE` override in `public/config.js`.

## Testing

### Planner Regression Tests

Run the automated planner test suite:
```bash
npm run test:planner
```

This executes 5 test scenarios covering:
- Stack reversal
- Tower building
- Interleaved restacking
- Table anchoring
- Invalid goal detection

### Manual Testing Workflow

1. Create user account
2. Add blocks A, B, C
3. Set goal "A on B on C"
4. Verify planning and execution
5. Save and reload world
6. Test planner endpoint directly:
```bash
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{"stacks":[["C"],["B","A"]],"goalChain":["A","B","C"]}'
```

## Docker Deployment

### Quick Start

The application includes production-ready Docker support with MongoDB.

**Using Setup Scripts:**

Windows:
```cmd
docker-setup.bat
```

macOS/Linux:
```bash
chmod +x docker-setup.sh
./docker-setup.sh
```

**Manual Docker Compose:**

Production:
```bash
docker compose up --build -d
```

Development (with live reload):
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Node.js BDI application |
| `mongo` | 27017 | MongoDB database (dev only) |

### Docker Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Clean reset (removes volumes)
docker compose down -v

# Access MongoDB shell
docker compose exec mongo mongosh blocks_world

# Check health
curl http://localhost:3000/health
```

### Environment Variables

Create `.env` file for custom configuration:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo:27017/blocks_world
ALLOWED_ORIGINS=https://yourdomain.com
```

### Docker Architecture

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

### Production Deployment

For production deployment:

1. Use `docker-compose.yml` (not dev version)
2. Set proper environment variables in `.env`
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

### Docker Troubleshooting

**Port 3000 already in use:**
```bash
# Linux/macOS
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**MongoDB connection issues:**
```bash
# Check MongoDB logs
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
---