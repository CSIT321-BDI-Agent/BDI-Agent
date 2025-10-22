# BDI Blocks World (BDI-Agent)

## TL;DR
- Container-first Blocks World simulator pairing an Express/Mongo backend with an ES-module frontend.
- Planner dashboard streams belief/desire/intention cycles with animated claw moves, live stats, and saved-world persistence.
- Authenticated workflow with per-user storage, admin console, profile management, and JSON import/export utilities.
- Runs cleanly in Docker; manual Node.js + MongoDB setup remains supported for debugging or custom integrations.

## Install & Run

### Docker (recommended)
1. Clone the repo:
   ```bash
   git clone https://github.com/CSIT321-BDI-Agent/BDI-Agent.git
   cd BDI-Agent
   ```
2. Launch the stack (app + MongoDB):
   ```bash
   docker compose up --build -d
   ```
3. Open the simulator at <http://localhost:3000>, create an account, and explore the planner.
4. Shut everything down when finished:
   ```bash
   docker compose down
   ```
   Need live reload while developing? Use `docker compose -f docker-compose.dev.yml up --build` for hot-reload mounts.

### Manual setup (when Docker is not an option)
1. Install dependencies at the project root: `npm install`
2. Create backend environment config:
   ```bash
   cp backend/.env.example backend/.env
   # provide MONGODB_URI and JWT_SECRET at minimum
   ```
3. Start MongoDB locally (or point `MONGODB_URI` at an Atlas/hosted instance).
4. Build Tailwind styles once (`npm run build:css`) or keep them hot (`npm run watch:css`).
5. Run the API from `backend/`:
   ```bash
   cd backend
   npm start
   ```
   The Express server serves the frontend from `public/` and proxies API routes on the same port (`3000`).

### Useful commands
```bash
# Tailwind rebuild while styling
npm run watch:css

# Follow container logs
docker compose logs -f app

# Reset containers + volumes
docker compose down -v
```

Environment overrides live in a project-level `.env`; Compose mounts it automatically. See `backend/.env.example` for supported keys.

## Architecture Overview

Belief-Desire-Intention (BDI) planning drives the simulator. A single js-son agent (`backend/bdi/blocksWorldAgent.js`) expands logical moves into four claw steps (move, pick, move, drop) so the frontend can animate every action.

- **Beliefs**: Current stacks, pending relations, derived `onMap`, and `clearBlocks` snapshots. Captured per iteration for later playback.
- **Desires**: Achieve the requested goal chain; remains active until the stacks satisfy the target configuration.
- **Intentions**: A regression-based plan decides whether to clear blockers, prep destinations, or stack the target block. Each choice surfaces on the intention timeline.

Planner loop highlights:
1. **Perceive** – recompute beliefs after each action.
2. **Deliberate** – evaluate whether the goal remains unsatisfied.
3. **Plan** – choose the next action (`CLEAR_BLOCK`, `CLEAR_TARGET`, `STACK`).
4. **Act** – apply the move, expand it into four claw steps, append to the intention log.

Run `npm run test:planner` inside `backend/` to inspect regression cases and generated logs.

## Railway Deployment

Railway builds from the repo root (`npm ci`) and launches `node backend/server.js`. Keep deployments healthy by providing:

- **MongoDB connection** – Railway service (`MONGO_URL`, `MONGO{HOST|PORT|USER|PASSWORD}`) or a managed URI (`MONGODB_URI`, `DATABASE_URL`).
- **JWT secret** – `JWT_SECRET` is mandatory outside local dev.
- **Optional admin bootstrap** – `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- **Frontend config** – expose `FRONTEND_API_BASE` when serving the UI from a different domain.

Let Railway supply `PORT`; the server listens on `0.0.0.0` automatically. Manage secrets in Railway, not in-code.

## Project Layout

```
BDI-Agent/
├── backend/            # Express API, BDI planner, persistence layer
├── public/             # Frontend (dashboard, auth screens, admin tools)
├── docker-compose.yml  # Production-friendly stack
├── docker-compose.dev.yml
└── README.md           # You're here
```

Key frontend documents:

- `public/index.html` – primary dashboard and simulation controls
- `public/admin.html` – admin console with responsive navigation
- `public/profile.html` – account overview and credential management
- `public/utils/` – ES modules for animation, persistence, stats, timeline, auth, etc.

## Contributing & Tips

- Run `npm run watch:css` while iterating on Tailwind utilities.
- Keep planner and persistence changes mirrored between frontend (`public/utils/persistence.js`, `timeline.js`, `stats.js`) and backend schemas.
- Route handlers should leverage `withRoute` and validation helpers (`backend/utils/validators.js`) for consistent error handling.
- Saved worlds capture stacks, colours, stats, and intention logs—update both the schema and UI helpers when adding fields.
- Need more detail? See [`backend/README.md`](backend/README.md) and [`public/README.md`](public/README.md) for subsystem specifics.
