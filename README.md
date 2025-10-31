# BDI Blocks World (BDI-Agent)

## TL;DR
- Quick start: `docker compose up --build -d` from the repo root, then visit <http://localhost:3000>.
- No Docker? `npm install`, copy `backend/.env.example` to `.env`, start MongoDB, and run `npm start` inside `backend/`.
- Two-agent BDI planner (Agent-A & Agent-B) expands each logical move into four claw steps so the dashboard can animate, log, and persist every cycle.
- Dashboard includes live stats, action log, intention timeline, saved-world replay, admin tools, profile management, and guarded authentication flows (accounts must be `active` to sign in).
- Save prompts use an in-app overlay component so the experience is consistent across devices without relying on browser dialogs.

## Quick Start
### Docker (recommended)
1. Install Docker Desktop Community version.
2. Clone the repo and switch to the project directory.
3. Launch the stack (app + MongoDB):
   ```bash
   docker compose up --build -d
   ```
4. If launching the stack returns errors, you are likely missing environmental values docker uses to initialise, therefore copy `backend/.env.example` and rename it to `../.env`. Then launch the stack again. 
5. Open <http://localhost:3000>, create an account, and start experimenting with the planner.
6. When finished, stop services with:
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
4. Build Tailwind output once (`npm run build:css`) or keep it updated (`npm run watch:css`). Most layout tweaks now live in Tailwind utility classes, so rebuild when you change `public/tailwind.css`.
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
Belief-Desire-Intention planning drives the simulator. A js-son-powered agent (`backend/bdi/blocksWorldAgent.js`) expands every logical move into four claw steps (move, pick, move, drop) so the frontend can animate each action while keeping stats and timelines in sync. Whether a goal describes one tower or many, only two agents (Agent-A and Agent-B) ever execute moves; additional towers are scheduled across those arms.

- **Beliefs**: Current stacks, pending relations, derived `onMap`, and `clearBlocks` snapshots for every iteration.
- **Desires**: Achieve the requested goal chain; stays active until stacks match the target configuration.
- **Intentions**: Regression planner chooses between clearing blockers, prepping destinations, or stacking the target block. Each decision is surfaced on the intention timeline.

Planner loop highlights:
1. **Perceive** – recompute beliefs after each action.
2. **Deliberate** – evaluate whether the goal remains unsatisfied.
3. **Plan** – choose the next action (`CLEAR_BLOCK`, `CLEAR_TARGET`, `STACK`).
4. **Act** – apply the move, expand it into claw steps, append to the intention log.

The simulator always renders two robotic claws (Agent-A and Agent-B). When more than two tower goals are provided, the planner interleaves extra work across those same agents so the UI never spawns invisible or duplicate arms. Claw rendering is now separated from the world width so prompt overlays always sit above them.

Run `npm run test:planner` inside `backend/` for regression scenarios and generated logs.

## Authentication & Accounts
- Users now carry a `status` (`active`, `pending`, `suspended`). Only `active` accounts can authenticate, and protected routes double-check status server-side.
- Frontend auth utilities persist the status alongside the JWT and refuse to store tokens if the account is inactive.
- Signup includes a password confirmation field and stricter feedback loops.
- Both login and saved-world fetchers detect `401/403` responses, clear stale tokens, and guide the user back to the auth screens.

## Frontend UX Updates
- Saving worlds uses a reusable overlay prompt component (`public/utils/prompt-dialog.js`) instead of the native `prompt()` API. The overlay dynamically injects its markup, captures focus, and darkens the screen with a translucent backdrop.
- The simulation environment respects the viewport on mobile: the wrapper scrolls horizontally without pushing the rest of the dashboard wider than the device.
- Prompt overlays sit atop the claw arms and the rest of the UI with a high z-index and dedicated backdrop click handling.

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
- Saved worlds capture stacks, colours, stats, multi-agent flags, and intention logs—update both schema and UI helpers when adding fields.
- For more subsystem detail, see [`backend/README.md`](backend/README.md) and [`public/README.md`](public/README.md).
