# Backend (Express API & BDI Planner)

This directory hosts the server-side portion of the Blocks World simulator: an Express app, a JS-son powered BDI planner, and MongoDB persistence for saved worlds.

---

## Features at a Glance

- JWT-authenticated API with per-user world storage and admin-only management routes.
- Planner endpoint (`POST /plan`) wraps the JS-son agent and enforces sane iteration caps.
- Saved worlds persist the latest stacks, colour assignments, and intention timeline snapshots.
- Structured error handling via `utils/routeHandler.js` and validation helpers.

---

## Running the Backend

### With Docker (preferred)

From the repository root:

```bash
docker compose up --build -d          # production style
# or
docker compose -f docker-compose.dev.yml up --build  # watch mode
```

The app listens on port `3000` and connects to the bundled MongoDB instance. Environment variables from the project-level `.env` are automatically injected.

### Manual setup

```
npm install
cp .env.example .env   # provide MONGODB_URI + JWT_SECRET at minimum
npm start
```

MongoDB must be reachable at the URI you configure (local instance or Atlas connection string).

---

## Directory Layout

```
backend/
├── server.js             # Express app bootstrap and API routes
├── bdi/
│   ├── blocksWorldAgent.js  # JS-son planner wrapper
│   └── utils/blocks.js      # Planning helpers
├── models/
│   ├── User.js           # Auth model
│   └── World.js          # Saved world schema (stacks, colours, timeline)
├── utils/
│   ├── auth.js           # JWT middleware
│   ├── adminRoutes.js    # Admin-only endpoints
│   ├── database.js       # Mongo connection + retry logic
│   ├── routeHandler.js   # Async error wrapper
│   └── validators.js     # Input sanitizers
├── planner-debug.js      # Regression scenarios for the planner
└── README.md             # This file
```

---

## API Summary

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/users/signup` | Create a new user |
| `POST` | `/login` | Obtain JWT (7-day expiry) |
| `POST` | `/worlds` | Save world (requires JWT) – expects `name`, `blocks`, `stacks`, optional `colours`, `timeline` |
| `GET`  | `/worlds` | List current user's saved worlds |
| `GET`  | `/worlds/:id` | Retrieve a specific saved world |
| `DELETE` | `/worlds/:id` | Delete a saved world |
| `POST` | `/plan` | Run the BDI planner on provided stacks/goal (requires JWT) |
| `GET`  | `/admin/users` | Admin: list users |
| `POST` | `/admin/users/:id/promote` | Admin: elevate user role |
| `POST` | `/admin/users/:id/demote` | Admin: reduce user role |
| `DELETE` | `/admin/users/:id` | Admin: remove user |
| `GET` | `/health` | Service health for monitoring |

> Planner payload validation rejects invalid block identifiers and caps `maxIterations` at 5,000 to prevent runaway simulations.

Saved world documents now resemble:

```jsonc
{
  "name": "Tower A",
  "blocks": ["A", "B", "C"],
  "stacks": [["C", "B", "A"]],
  "colours": { "A": "hsl(...)", "B": "hsl(...)" },
  "timeline": { "log": [...], "clockDisplay": "00:14.52", ... },
  "stats": { "steps": 12, "timeElapsedMs": 14520, "timeElapsed": "14.52s", "status": "Completed" },
  "user": "64f...",
  "createdAt": "..."
}
```

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Port for the API | `3000` |
| `MONGODB_URI` | Mongo connection string (also checks `MONGODB_URL`, `MONGO_URL`, `DATABASE_URL`) | `mongodb://localhost:27017/blocks_world` |
| `FRONTEND_API_BASE` | Optional base URL injected into `config.js` (falls back to Railway's `MONGO_URL`/`MONGOHOST`/`MONGOPORT`/`MONGOUSER`/`MONGOPASSWORD`) | _auto-resolved_ |
| `JWT_SECRET` | Signing secret for auth tokens | _required in production_ |
| `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Optional bootstrap admin |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist (prod) | Browser localhost hosts |

---

## Testing & Tooling

- Planner regression suite: `npm run test:planner`
- Multi-agent regression suite: `npm run test:multi-agent`
- Logs are standard `console.log`/`console.error`; combine with `docker compose logs app` when running in containers.
- Health endpoint (`/health`) reports uptime and MongoDB connection status for Compose or Kubernetes probes.

---

## Tips

- All route handlers should be wrapped with `withRoute` to ensure proper error propagation.
- Use helpers in `validators.js` instead of hand-rolling request parsing.
- When evolving the saved world schema, update both `models/World.js` and the frontend persistence helper to keep persistence logic in sync.

For broader project information or frontend details, refer back to the [root README](../README.md) and [`public/README.md`](../public/README.md).









