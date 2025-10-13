# BDI Blocks World (BDI-Agent)

Beliefâ€“Desireâ€“Intention planning for the classic Blocks World, shipped as a full-stack playground. The project now favours a container-first workflow so you can be exploring the simulator in minutesâ€”no local MongoDB, no manual dependency wrangling.

---

## TL;DR

- Interactive planner dashboard with live stats, timeline playback, and saved-world persistence (including intention logs).
- Authenticated persistence per user; admins can promote/demote accounts from the in-app console.
- Self-serve profile page summarises account details and supports credential updates.
- Clean ESâ€‘module frontend, Express/Mongo backend, both tailored to run together inside Docker.

---

## Quick Start (Docker â€“ Recommended)

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

- Add a **MongoDB service** or supply a hosted connection string. Railway exposes it as `MONGO_URL`, `MONGODB_URL`, or `DATABASE_URL`; the server now checks all of them automatically.
- Populate `JWT_SECRET` (required), plus any bootstrap admin credentials you need (`ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- Surface the backend URL to the frontend with `FRONTEND_API_BASE=https://${{ MONGOHOST }}:${{ MONGOPORT }}`. Railway expands service-scoped variables (`MONGO_URL`, `MONGOHOST`, `MONGOPORT`, `MONGOUSER`, `MONGOPASSWORD`) so the browser points at the correct service.
- Leave `PORT` unsetâ€”Railway injects its own `PORT` value and the server already binds to `0.0.0.0`.
- If you enable a static frontend on another domain, set `ALLOWED_ORIGINS` with a comma-separated list so CORS stays open in production.

No `.env` file is required in the repoâ€”manage secrets from the Railway dashboard so automated deployments stay in sync.

---

## Manual Setup (When You Really Need It)

The repo still supports a traditional setup (Node.js â‰¥ 18 and MongoDB â‰¥ 5). High-level steps:

1. `npm install`
2. Copy `backend/.env.example` to `backend/.env` and supply `MONGODB_URI` & `JWT_SECRET`
3. Start MongoDB locally or point to Atlas
4. `npm run build:css` (or `npm run watch:css`) for the Tailwind bundle
5. From `backend/`: `npm start`

Detailed backend/frontend guidance now lives in each subdirectory:

- [`backend/README.md`](backend/README.md) â€“ routes, env vars, testing, and architecture notes
- [`public/README.md`](public/README.md) â€“ UI structure, modules, and styling workflow

---

## Project Layout

```
BDI-Agent/
â”œâ”€â”€ backend/            # Express API, BDI planner, persistence layer
â”œâ”€â”€ public/             # Frontend (dashboard, auth screens, debug tools)
â”œâ”€â”€ docker-compose.yml  # Production-friendly stack
â”œâ”€â”€ docker-compose.dev.yml
â””â”€â”€ README.md           # You're here
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
- Planner regression tests live in `backend/planner-debug.js` (`npm run test:planner`).
- Saved worlds capture blocks, colours, and timelines. When editing persistence, update both the frontend helper and the `World` schema.

Questions? Raise a GitHub issue or ping the project maintainers. Happy planning!

