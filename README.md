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

More details are available in `DOCKER.md` and `DEPLOYMENT.md`.

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
├── bdi/                  # JS-son agent and planning utilities
│   └── blocksWorldAgent.js
├── server.js              # Express server and API routes
├── package.json           # Dependencies and project metadata
├── public/                # Static frontend files
│   ├── index.html         # Main simulation interface
│   ├── login.html         # User authentication
│   ├── signup.html        # User registration
│   ├── script.js          # Core simulation engine
│   └── style.css          # Styling and animations
└── .github/
    └── copilot-instructions.md  # AI coding guidelines
```

### API Endpoints
- `POST /users/signup` - User registration
- `POST /login` - User authentication
- `POST /worlds` - Save world configuration
- `GET /worlds/:id?userId=` - Load specific world
- `POST /plan` - Generate a JS-son BDI plan for the provided stacks/goal
- Static files served from `/public`

### Development Workflow
1. **Backend Changes**: Edit `server.js` and restart with `node server.js`
2. **Frontend Changes**: Edit files in `public/` and refresh browser
3. **Database**: MongoDB collections: `users` and `worlds`

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

Currently no automated tests. Manual testing workflow:
1. Create user account
2. Add blocks A, B, C
3. Set goal "A on B on C"
4. Verify planning and execution (optionally inspect `/plan` response via browser dev tools or `curl`)
5. Save and reload world
6. Hit `POST /plan` directly with JSON payload to ensure the JS-son agent responds as expected

Stretch goal is to create CI/CD unit tests for the application.
---