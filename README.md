# BDI Blocks World (BDI-Agent)

Belief–Desire–Intention planning for the classic Blocks World, shipped as a full-stack playground. The project now favours a container-first workflow so you can be exploring the simulator in minutes—no local MongoDB, no manual dependency wrangling.

---

## TL;DR

- Interactive planner dashboard with live stats, timeline playback, and saved-world snapshots (including intention logs and elapsed time).
- Authenticated persistence per user; admins can promote/demote accounts from the in-app console.
- Clean ES‑module frontend, Express/Mongo backend, both tailored to run together inside Docker.

---

## Quick Start (Docker – Recommended)

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

---

## Manual Setup (When You Really Need It)

The repo still supports a traditional setup (Node.js ≥ 18 and MongoDB ≥ 5). High-level steps:

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

- `public/index.html` – primary dashboard (reference layout for the app)
- `public/admin.html` – admin console using the same responsive shell
- `public/login.html` / `public/signup.html` – auth surfaces with shared styling
- `public/utils/` – ES modules for animation, persistence, stats, timeline, etc.

---

## Contributing & Guidance

- Run `npm run watch:css` while tweaking Tailwind utilities.
- Linting is lightweight; focus on keeping modules pure and adding doc comments where behaviour is non-obvious.
- Planner regression tests live in `backend/planner-debug.js` (`npm run test:planner`).
- Saved worlds now capture blocks, colours, timelines, **and** stat snapshots. When editing persistence, update both the frontend helper and the `World` schema.

Questions? Raise a GitHub issue or ping the project maintainers. Happy planning!
