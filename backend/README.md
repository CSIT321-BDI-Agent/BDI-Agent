# Backend (Express API & BDI Planner)

## Highlights
- JWT-protected REST API for login, world persistence, planner access, and admin management.
- JS-son powered Belief-Desire-Intention agent (`bdi/blocksWorldAgent.js`) that expands every logical move into four robotic claw steps.
- Saved worlds capture stacks, colours, stats, and intention logs so the frontend can replay runs exactly.
- Shared utilities for validation (`utils/validators.js`), error handling (`utils/routeHandler.js`), and MongoDB connection management (`utils/database.js`).

## Run It

### Docker (preferred)
From the repository root:
```bash
docker compose up --build -d              # production-like stack
# or, with live reload and volume mounts
docker compose -f docker-compose.dev.yml up --build
```
The API listens on `http://localhost:3000` and ships with MongoDB in the same Compose stack. Environment values from the project-level `.env` are mapped into the container automatically.

### Local Node.js setup
```bash
npm install                      # run at the repository root
cp backend/.env.example backend/.env
# fill in MONGODB_URI + JWT_SECRET (others optional)
cd backend
npm start                        # starts Express on port 3000
```
Point `MONGODB_URI` at a running Mongo instance (local or hosted). The server serves the frontend bundle from `public/` on the same port.

## Directory Layout

```
backend/
├── server.js             # Express bootstrap, world CRUD, planner endpoint, config injection
├── bdi/
│   ├── blocksWorldAgent.js  # JS-son agent wrapper + move expansion
│   └── utils/blocks.js      # Planning helpers and validators
├── models/
│   ├── User.js           # User schema, auth utilities, bootstrap admin
│   └── World.js          # Saved world schema (stacks, colours, timeline, stats)
├── utils/
│   ├── auth.js           # JWT middleware (attachUser, requireAuth, checkAdmin)
│   ├── adminRoutes.js    # Admin-only routes for user management + world stats
│   ├── database.js       # Mongo connection / retry logic
│   ├── httpError.js      # Lightweight HttpError class
│   ├── jwt.js            # Environment-aware JWT secret resolution
│   ├── routeHandler.js   # Async error wrapper
│   └── validators.js     # Payload sanitizers
├── planner-debug.js      # Regression scenarios for planner loop
├── multi-agent-regression.js  # Optional multi-agent negotiation checks
└── README.md             # This file
```

## API Summary

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/users/signup` | Create a user |
| `POST` | `/login` | Authenticate and receive a 7-day JWT |
| `GET`  | `/worlds` | List the current user's saved worlds |
| `POST` | `/worlds` | Save a world snapshot (requires JWT) |
| `GET`  | `/worlds/:id` | Retrieve a saved world by id |
| `DELETE` | `/worlds/:id` | Delete a saved world |
| `POST` | `/plan` | Run the BDI planner for provided stacks/goal |
| `GET`  | `/admin/users` | Admin: list users with world stats |
| `POST` | `/admin/users/:id/promote` | Admin: promote to admin |
| `POST` | `/admin/users/:id/demote` | Admin: demote to user |
| `DELETE` | `/admin/users/:id` | Admin: delete a user |
| `GET`  | `/health` | Service health (uptime + Mongo status) |

Planner payload validation clamps iteration counts, enforces single-letter block names, and ensures goal chains resolve to the table.

## Environment Variables

| Variable | Purpose | Notes |
|----------|---------|-------|
| `PORT` | API port | Defaults to `3000`; honour platform-provided values |
| `MONGODB_URI` | Mongo connection string | Falls back through `MONGODB_URL`, `MONGO_URL`, `DATABASE_URL`, or host/port combos |
| `JWT_SECRET` | JWT signing secret | Required in production |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist | Defaults to browser dev origins |
| `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Optional bootstrap admin | Used once on startup |
| `FRONTEND_API_BASE` | URL injected into `/config.js` response | Auto-resolved for Railway-style setups |

See `server.js` for the full list of environment probes—it supports Railway, Docker, and traditional .env patterns.

## Testing & Tooling

- Planner regression suite: `npm run test:planner`
- Multi-agent negotiation suite: `npm run test:multi-agent`
- Compose helper scripts are exposed via `npm run docker:*`
- Logs surface via standard `console.log`/`console.error`; pair with `docker compose logs app` in container setups.

## Tips

- Wrap new routes with `withRoute` and reuse helpers in `utils/validators.js`.
- Keep the saved world schema and frontend persistence helpers in sync when evolving fields like `timeline` or `stats`.
- The planner intentionally caps iterations (5,000) to prevent runaway scenarios—adjust in `blocksWorldAgent.js` if experimentation demands more.
- Use the `/config.js` endpoint when debugging frontend configuration; it reflects the resolved API base and auth requirements.
