# BDI Blocks World (BDI-Agent)

Belief-Desire-Intention planning for the classic Blocks World, shipped as a full-stack playground. The project now favours a container-first workflow so you can be exploring the simulator in minutes - no local MongoDB, no manual dependency wrangling.

---

## TL;DR

- Interactive planner dashboard with live stats, timeline playback, and saved-world persistence (including intention logs).
- Authenticated persistence per user; admins can promote/demote accounts from the in-app console.
- Self-serve profile page summarises account details and supports credential updates.
- Clean ES-module frontend, Express/Mongo backend, both tailored to run together inside Docker.

---

## BDI Architecture at a Glance

The planner centres on a single js-son-agent (`backend/bdi/blocksWorldAgent.js`) that follows the classic Belief-Desire-Intention loop.

- **Beliefs**: Current stacks, goal chain, derived `onMap`, `clearBlocks`, and the pending relation to resolve. Captured in the intention log and echoed to the frontend so animations stay in sync.
- **Desires**: One achievement goal (`achieveGoal`) that remains active while the stacks fail to satisfy the requested goal chain.
- **Intentions**: A single plan (`planAchieveGoal`) that performs goal-regression. It clears blocking pieces, prepares the destination, then performs the stack, emitting four distinct claw steps per logical move.

**Planner loop**:
1. **Perceive** - `stateFilter()` recomputes beliefs after each action.
2. **Deliberate** - evaluate `achieveGoal`; if unsatisfied, stick with the current plan.
3. **Plan** - decide between `CLEAR_BLOCK`, `CLEAR_TARGET`, or `STACK` actions.
4. **Act** - apply the move, expand it to four claw steps, and append entries to the intention log for frontend replay.

You can inspect the full cycle by running `npm run test:planner` and reviewing the generated intention logs.

---
---

## Quick Start (Docker - Recommended)

1. **Clone the repo**
   ```bash
   git clone https://github.com/CSIT321-BDI-Agent/BDI-Agent.git
   cd BDI-Agent
   ```
2. **Launch the stack**
   ```bash
   docker compose up --build -d
   ```
   The default Compose file bundles the Node/Express app and MongoDB with sensible defaults.
3. **Open the simulator** at <http://localhost:3000> and create an account. The UI runs entirely in the browser; the API is proxied through the same port.
4. **Shut down** when you are done:
   ```bash
   docker compose down
   ```

> Need live-reload while you code? Use `docker compose -f docker-compose.dev.yml up --build` for watch mode.

### Useful Docker Commands

```bash
# Stream logs
docker compose logs -f

# Restart only the app service
docker compose restart app

# Drop containers + volumes (cold reset)
docker compose down -v
```

Environment overrides live in `.env` at the project root (see examples inside `backend/.env.example`). Compose automatically maps it into the containers.

## Railway Deployment

Railway picks up this repo without extra build steps: it runs `npm ci` in the root, then launches `node backend/server.js`. To keep deployments healthy:

- Add a **MongoDB service** or supply a hosted connection string. Railway exposes it as `MONGO_URL`, `MONGODB_URL`, `DATABASE_URL`, or split credentials like `MONGOHOST`/`MONGOPORT`; the server now resolves them automatically.
- Populate `JWT_SECRET` (required), plus any bootstrap admin credentials you need (`ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- Surface the backend URL to the frontend with `FRONTEND_API_BASE=https://${{ MONGOHOST }}:${{ MONGOPORT }}`. Railway expands service-scoped variables (`MONGO_URL`, `MONGOHOST`, `MONGOPORT`, `MONGOUSER`, `MONGOPASSWORD`) so the browser points at the correct service.
- Leave `PORT` unset - Railway injects its own `PORT` value and the server already binds to `0.0.0.0`.
- If you enable a static frontend on another domain, set `ALLOWED_ORIGINS` with a comma-separated list so CORS stays open in production.

No `.env` file is required in the repo - manage secrets from the Railway dashboard so automated deployments stay in sync.

---

## Manual Setup (When You Really Need It)

The repo still supports a traditional setup (Node.js >= 18 and MongoDB >= 5). High-level steps:

1. `npm install`
2. Copy `backend/.env.example` to `backend/.env` and supply `MONGODB_URI` & `JWT_SECRET`
3. Start MongoDB locally or point to Atlas
4. `npm run build:css` (or `npm run watch:css`) for the Tailwind bundle
5. From `backend/`: `npm start`

Detailed backend/frontend guidance now lives in each subdirectory:

- [`backend/README.md`](backend/README.md) – routes, env vars, testing, and architecture notes
- [`public/README.md`](public/README.md) – UI structure, modules, and styling workflow

---

## Project Layout

```
BDI-Agent/
├── backend/            # Express API, BDI planner, persistence layer
├── public/             # Frontend (dashboard, auth screens, debug tools)
├── docker-compose.yml  # Production-friendly stack
├── docker-compose.dev.yml
└── README.md           # You're here
```

Key frontend documents:

- `public/index.html` - primary dashboard (reference layout for the app)
- `public/admin.html` - admin console using the same responsive shell
- `public/profile.html` - account overview with editable credentials and saved-world count
- `public/login.html` / `public/signup.html` - auth surfaces with shared styling
- `public/utils/` - ES modules for animation, persistence, stats, timeline, etc.

---

## Contributing & Guidance

- Run `npm run watch:css` while tweaking Tailwind utilities.
- Linting is lightweight; focus on keeping modules pure and adding doc comments where behaviour is non-obvious.
- Planner regression tests live in `backend/planner-debug.js` (`npm run test:planner`). The suite covers table anchoring, claw-step expansion, iteration caps, and invalid planner configurations so backend and frontend stay in lockstep.
- Saved worlds capture blocks, colours, and timelines. When editing persistence, update both the frontend helper and the `World` schema.
