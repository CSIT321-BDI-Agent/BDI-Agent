# Backend (Express API & BDI Planner)

## Highlights
- JWT-secured REST API powering login, world persistence, planner access, and admin tooling.
- Multi-agent BDI planner (`bdi/multiAgentEnvironment.js`) with negotiation, independent tower planning, and Claw-step expansion. Execution is capped at two agents (Agent-A and Agent-B); additional towers are time-sliced across them.
- Saved worlds persist stacks, colours, stats, intention timeline, and planner metadata for replay.
- Shared utilities for validation (`utils/validators.js`), error handling (`utils/routeHandler.js`), database connectivity, and auth guards.

## Running the Backend
### Docker (preferred)
From the repository root:
```bash
docker compose up --build -d              # production-like stack
# or, with hot reload and mounted volumes
docker compose -f docker-compose.dev.yml up --build
```
The API listens on <http://localhost:3000> alongside MongoDB. Environment values from the project-level `.env` are injected automatically.

### Local Node.js setup
```bash
npm install                      # run at the repository root
cp backend/.env.example backend/.env
# fill in MONGODB_URI + JWT_SECRET (others optional)
cd backend
npm start                        # starts Express on port 3000
```
Point `MONGODB_URI` at a running MongoDB instance (local or hosted). The server also serves the frontend bundle from `public/` on the same port.

## Directory Layout
```
backend/
  server.js                 Express bootstrap, world CRUD, planner endpoints
  bdi/
    blocksWorldAgent.js     JS-son agent wrapper + move expansion
    multiAgentEnvironment.js Multi-agent orchestration, negotiation manager
    utils/blocks.js         Planning helpers and validation logic
  models/
    User.js                 User schema, auth utilities, admin bootstrap
    World.js                Saved world schema (stacks, colours, timeline, stats)
  utils/
    auth.js                 JWT middleware (attachUser, requireAuth, checkAdmin)
    adminRoutes.js          Admin-only routes for user management
    database.js             Mongo connection / retry logic
    httpError.js            Lightweight HttpError class
    jwt.js                  JWT secret resolution
    routeHandler.js         Async route wrapper
    validators.js           Payload sanitizers
  planner-debug.js          Regression scenarios for planner loop
  multi-agent-regression.js Multi-agent regression and API smoke tests
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
| `POST` | `/plan` | Run the single-agent BDI planner |
| `POST` | `/multi-agent-plan` | Run the multi-agent planner |
| `GET`  | `/admin/users` | Admin: list users with world stats |
| `POST` | `/admin/users/:id/promote` | Admin: promote to admin |
| `POST` | `/admin/users/:id/demote` | Admin: demote to user |
| `DELETE` | `/admin/users/:id` | Admin: delete a user |
| `GET`  | `/health` | Service health (uptime + Mongo status) |

Planner payload validation caps iteration counts, enforces single-letter block names, and normalises goal chains so they terminate at the table.

## Environment Variables
| Variable | Purpose | Notes |
|----------|---------|-------|
| `PORT` | API port | Defaults to `3000`; honour platform-provided values |
| `MONGODB_URI` | Mongo connection string | Falls back through `MONGODB_URL`, `MONGO_URL`, `DATABASE_URL`, or host/port combos |
| `JWT_SECRET` | JWT signing secret | Required outside local dev |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist | Defaults to development origins |
| `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Optional bootstrap admin | Applied once on startup |
| `FRONTEND_API_BASE` | URL injected into `/config.js` response | Auto-resolved for Railway-style setups |

See `server.js` for the exhaustive environment resolution matrix (supports Railway, Docker, and conventional `.env` files).

## Testing & Tooling
- Planner regression suite: `npm run test:planner`
- Multi-agent negotiation suite: `npm run test:multi-agent`
- Docker helpers: `npm run docker:*` (defined in project root)
- Logs surface via `console.log` / `console.error`; use `docker compose logs app` in container setups.

## Tips
- Wrap new routes with `withRoute` and reuse helpers in `utils/validators.js`.
- Keep saved world schema changes mirrored in the frontend persistence helpers.
- Planner iterations are capped (default 2,500); tweak in `blocksWorldAgent.js` for experimentation.
- `/config.js` endpoint mirrors resolved runtime configuration for frontend consumers; helpful when debugging API base URLs.
