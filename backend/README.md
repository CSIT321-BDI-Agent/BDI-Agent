# BDI-Agent Backend

This directory contains the backend server for the BDI-Agent Blocks World Simulator.

## Structure

```
backend/
├── server.js                    # Express server and API routes
├── package.json                 # Node.js dependencies
├── bdi/                         # BDI agent logic
│   ├── blocksWorldAgent.js      # JS-son planner
│   └── utils/
│       └── blocks.js            # Block world validators/helpers
├── models/                      # MongoDB schemas
│   ├── User.js                  # User authentication model
│   └── World.js                 # World persistence model
├── utils/                       # Server utilities
│   ├── database.js              # MongoDB connection
│   ├── auth.js                  # JWT authentication
│   ├── validators.js            # Input validation
│   ├── routeHandler.js          # Error handling wrapper
│   ├── httpError.js             # Custom error class
│   └── adminRoutes.js           # Admin panel routes
├── mongo-init.js                # MongoDB initialization
├── planner-debug.js             # Planner test suite
└── .env.example                 # Environment variables template
```

## Quick Start

### Local Development (Manual)

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Ensure MongoDB is Running**
   - Local: `mongod` (default: `mongodb://localhost:27017`)
   - Or use MongoDB Atlas connection string

4. **Start Server**
   ```bash
   npm start
   ```

Server runs on `http://localhost:3000`

### Docker Development (Recommended)

From the **project root** directory:

```bash
# Development mode (with live reload)
docker compose -f docker-compose.dev.yml up --build

# Production mode
docker compose up --build
```

## API Endpoints

### Authentication
- `POST /users/signup` - Create new user account
- `POST /login` - Login and receive JWT token

### World Persistence
- `POST /worlds` - Save a world configuration
- `GET /worlds` - Get all worlds for a user
- `GET /worlds/:id` - Get specific world

### Planning
- `POST /plan` - Execute BDI planner on block configuration

### Admin (Requires JWT with admin role)
- `GET /admin/users` - List all users
- `PUT /admin/users/:id/role` - Update user role
- `DELETE /admin/users/:id` - Delete user

### Utility
- `GET /health` - Health check (Docker probe)

## Testing

Run planner regression tests:
```bash
npm run test:planner
```

## Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token signing (production)

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` - Default admin credentials

## Architecture Notes

- **Modular Design**: Utilities, models, and BDI logic are separated
- **Error Handling**: Centralized via `withRoute()` wrapper
- **Validation**: Input validation via `validators.js` helpers
- **Authentication**: JWT-based with role management
- **Database**: MongoDB with Mongoose ODM
- **Static Files**: Frontend served from `../public` directory

## Common Tasks

**Add New Route:**
```javascript
const withRoute = require('./utils/routeHandler');
const { ensureNonEmptyString } = require('./utils/validators');

app.post('/new-endpoint', withRoute(async (req, res) => {
  const param = ensureNonEmptyString(req.body.param, 'Parameter');
  // Your logic here
  res.json({ result: 'success' });
}));
```

**Modify Planner Behavior:**
Edit `bdi/blocksWorldAgent.js` or `bdi/utils/blocks.js`, then run tests.

**Add Database Model:**
Create new schema in `models/` following the pattern of `User.js` and `World.js`.

## Troubleshooting

**MongoDB connection fails:**
- Ensure MongoDB is running (local or Docker)
- Check `MONGODB_URI` in `.env`
- Docker: Connection auto-retries 5x

**Port already in use:**
- Change `PORT` in `.env`
- Kill existing process: `lsof -ti:3000 | xargs kill` (Unix) or Task Manager (Windows)

**JWT authentication fails:**
- Ensure `JWT_SECRET` is set in production
- Check token is sent in `Authorization: Bearer <token>` header

For more details, see the main project README.
