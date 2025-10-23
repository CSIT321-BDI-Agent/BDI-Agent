# BDI Blocks World (BDI-Agent)

## TL;DR
- Quick start: `docker compose up --build -d` from the repo root, then visit <http://localhost:3000>.
- No Docker? `npm install`, copy `backend/.env.example` to `.env`, start MongoDB, and run `npm start` inside `backend/`.
- Multi-agent Belief-Desire-Intention planner with an Express + Mongo backend and ES module frontend.
- Dashboard streams claw animations, intention timeline, live stats, and persists worlds for replay.

## Quick Start
### Docker (recommended)
1. Clone the repo and switch to the project directory.
2. Launch the stack (app + MongoDB):
   ```bash
   docker compose up --build -d
   ```
3. Open <http://localhost:3000>, create an account, and start experimenting with the planner.
4. When finished, stop services with:
   ```bash
   docker compose down
   ```
   Need hot reload? Use `docker compose -f docker-compose.dev.yml up --build` for volume mounts.

### Manual setup
1. Install root dependencies: `npm install`
2. Configure environment variables:
   ```bash
   cp backend/.env.example backend/.env
   # set MONGODB_URI and JWT_SECRET at minimum
   ```
3. Start MongoDB (local instance or hosted connection exposed via `MONGODB_URI`).
4. Build Tailwind output once (`npm run build:css`) or keep it updated (`npm run watch:css`).
5. Run the API from `backend/`:
   ```bash
   cd backend
   npm start
   ```
   The Express server serves the frontend from `public/` on the same port (`3000`).

## Useful Commands
```bash
# Tailwind rebuild while iterating on styles
npm run watch:css

# Follow container logs
docker compose logs -f app

# Reset containers and volumes
docker compose down -v
```

Project-level `.env` values are automatically mounted into Docker containers. See `backend/.env.example` for available keys.

## Architecture Overview
Belief-Desire-Intention planning drives the simulator. A js-son-powered agent (`backend/bdi/blocksWorldAgent.js`) expands every logical move into four claw steps (move, pick, move, drop) so the frontend can animate each action while keeping stats and timelines in sync.

- **Beliefs**: Current stacks, pending relations, derived `onMap`, and `clearBlocks` snapshots for every iteration.
- **Desires**: Achieve the requested goal chain; stays active until stacks match the target configuration.
- **Intentions**: Regression planner chooses between clearing blockers, prepping destinations, or stacking the target block. Each decision is surfaced on the intention timeline.

Planner loop highlights:
1. **Perceive** – recompute beliefs after each action.
2. **Deliberate** – evaluate whether the goal remains unsatisfied.
3. **Plan** – choose the next action (`CLEAR_BLOCK`, `CLEAR_TARGET`, `STACK`).
4. **Act** – apply the move, expand it into claw steps, append to the intention log.

Run `npm run test:planner` inside `backend/` for regression scenarios and generated logs.

## Deployment Notes
Railway builds from the repo root (`npm ci`) and launches `node backend/server.js`. Provide at least:

- `MONGODB_URI` (or equivalent) for Mongo connectivity.
- `JWT_SECRET` for signing tokens.
- Optional bootstrap credentials: `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- `FRONTEND_API_BASE` when serving the UI from a different origin.

The server automatically respects the runtime `PORT` and listens on `0.0.0.0`. Manage secrets through your hosting platform rather than committing them.

## Project Layout
```
BDI-Agent/
  backend/            Express API, BDI planner, persistence layer
  public/             Frontend dashboard, admin tools, auth screens
  docker-compose.yml  Production-friendly stack
  docker-compose.dev.yml
  README.md           Project overview
```

Key frontend modules:

- `public/index.html` – planner dashboard and simulation controls
- `public/admin.html` – admin console with responsive navigation
- `public/profile.html` – account overview and credential management
- `public/utils/` – ES modules for animation, persistence, stats, timeline, auth, etc.

## Contributing Tips
- Run `npm run watch:css` while working on Tailwind utilities.
- Keep planner and persistence changes mirrored between frontend (`public/utils/persistence.js`, `timeline.js`, `stats.js`) and backend schemas.
- Use `withRoute` and validation helpers (`backend/utils/validators.js`) for consistent API error handling.
- Saved worlds capture stacks, colours, stats, and intention logs—update both schema and UI helpers when adding fields.
- For more subsystem detail, see [`backend/README.md`](backend/README.md) and [`public/README.md`](public/README.md).
