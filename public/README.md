# Frontend (`public/`)

## Highlights
- Dashboard-driven Blocks World simulator with live stats, intention timeline, and claw animations.
- Authenticated workflow that mirrors backend capabilities: saved worlds, admin console, profile management, and agent log viewer.
- ES-module architecture—modules stay focused (`World`, `timeline`, `stats`, `persistence`, `ui-handlers`, etc.) and share selectors via `constants.js`.
- Tailwind-powered styling with a single generated bundle (`assets/app.css`).

## Pages
- `index.html` – primary simulator (planner controls, stacks viewport, saved worlds sidebar).
- `admin.html` – admin console that surfaces user management and saved-world summaries.
- `profile.html` – account overview with credential update flows.
- `agent-logs.html` – saved-world and execution log browser for quick auditing.
- `import-export.html` – JSON import/export utility for backups and sharing.
- `login.html` / `signup.html` – authentication forms with shared messaging UI.
- `debug.html` – lightweight API tester for planner and persistence endpoints.

## Build & Serve
1. Install dependencies at the repository root: `npm install`
2. Build or watch Tailwind output:
   ```bash
   npm run build:css   # single build
   npm run watch:css   # rebuild on file change
   ```
3. Run the backend (Docker or `npm start` inside `backend/`) so the static files and API share the same origin.
4. Visit <http://localhost:3000> while the backend is running, or open the HTML files directly for static-only exploration (authenticated features require the API).

## Key Modules (`public/utils/`)

| Module | Responsibility |
|--------|----------------|
| `main.js` | Boots the dashboard: creates `World`, wires handlers, resets timeline/stats |
| `ui-handlers.js` | Simulation controller (planner calls, animation orchestration, drag/drop) |
| `World.js` | Stack representation, DOM synchronisation, block colour management |
| `timeline.js` | Intention timeline rendering, clock, snapshot/restore |
| `stats.js` | Tracks planner steps, elapsed time, and status badges |
| `persistence.js` | Save/load helpers, rebuilds snapshots into live `World` + timeline/stats |
| `auth.js` | Login/signup helpers, JWT storage, route guards, authenticated fetch |
| `navigation.js` | Sidebar + mobile navigation set-up |
| `profile.js` | Shared profile dropdown and account update flows |
| `import-export.js` | JSON validation, clipboard export, file import |
| `agent-logs.js` | Fetches per-user saved worlds and summarises planner runs |

Shared selectors live in `constants.js`, ensuring modules touch the DOM consistently.

## Styling
- Source file: `tailwind.css`
- Output: `assets/app.css`
- Token definitions (colours, fonts, shadows) live in `tailwind.config.js` and `app.css`.
- Re-run `npm run build:css` whenever Tailwind utilities change if you are not running the watcher.

## Development Tips
- The frontend expects `window.APP_CONFIG` from the backend `/config.js` endpoint; ensure the server is running when debugging auth or API URLs.
- Timeline, stats, and persistence snapshots should always advance together—`persistence.js` coordinates the trio.
- Drag and drop interactions live in `drag-drop.js` and feed into `ui-handlers.js`; lock/unlock blocks when extending manual mutation logic.
- Use `helpers.js` (`showMessage`, `handleError`, `normalizeWorldIdentifier`) instead of bespoke messaging or error handling.
- For module-level work, start at `main.js` to see how each piece is initialised during dashboard bootstrap.
