# Frontend (`public/`)

## Highlights
- Dashboard-driven Blocks World simulator with live stats, intention timeline, and claw animations.
- Mirrors backend capabilities: saved worlds, admin console, profile management, agent log viewer, and multi-agent playback.
- Modular ES module architecture keeps concerns focused (`World`, `timeline`, `stats`, `persistence`, `ui-handlers`, etc.), with selectors centralised in `constants.js`.
- Tailwind-powered styling compiled into a single bundle (`assets/app.css`).

## Key Pages
- `index.html` – primary simulator (planner controls, stacks viewport, saved worlds sidebar).
- `admin.html` – admin console with user management and saved-world summaries.
- `profile.html` – account overview and credential update flows.
- `agent-logs.html` – saved-world and execution log browser.
- `import-export.html` – JSON import/export utility for backups and sharing.
- `login.html` / `signup.html` – authentication forms.
- `debug.html` – lightweight API tester for planner and persistence endpoints.

## Build & Serve
1. Install dependencies at the repository root: `npm install`
2. Build or watch Tailwind output:
   ```bash
   npm run build:css   # single build
   npm run watch:css   # rebuild on change
   ```
3. Run the backend (Docker or `npm start` inside `backend/`) so static assets and API share the origin.
4. Visit <http://localhost:3000> while the backend is running. Static-only exploration works by opening the HTML files directly, but authenticated features require the API.

## Modules (`public/utils/`)
| Module | Responsibility |
|--------|----------------|
| `main.js` | Boots the dashboard: creates `World`, wires handlers, resets timeline/stats |
| `ui-handlers.js` | Simulation controller (planner calls, animation orchestration, drag/drop integration) |
| `World.js` | Stack representation, DOM synchronisation, block colour management |
| `timeline.js` | Intention timeline rendering, clock, snapshot/restore helpers |
| `stats.js` | Tracks planner steps, elapsed time, status badges |
| `persistence.js` | Save/load helpers, rebuilds snapshots into live `World` + timeline/stats |
| `auth.js` | Login/signup helpers, JWT storage, route guards, authenticated fetch wrapper |
| `navigation.js` | Sidebar + mobile navigation set-up |
| `profile.js` | Profile dropdown and account update flows |
| `import-export.js` | JSON validation, clipboard export, file import |
| `agent-logs.js` | Fetches saved worlds and summarises planner runs |
| `drag-drop.js` | Pointer-driven block drag/drop with lock support |

Shared selectors live in `constants.js`, ensuring modules interact with the DOM consistently. Logger utilities sit in `logger.js` for action log entries.

## Styling
- Source: `tailwind.css`
- Output: `assets/app.css`
- Token definitions (colours, fonts, shadows) reside in `tailwind.config.js` and `app.css`.
- Re-run `npm run build:css` whenever Tailwind utilities change if the watcher is not running.

## Development Tips
- Frontend expects `window.APP_CONFIG` from the backend `/config.js` endpoint; keep the server running when debugging auth or API URLs.
- Timeline, stats, and persistence snapshots must advance together—`persistence.js` coordinates the trio.
- Drag and drop interactions live in `drag-drop.js` and feed into `ui-handlers.js`; lock/unlock blocks when extending manual mutation logic.
- Use helpers in `helpers.js` (`showMessage`, `handleError`, `normalizeWorldIdentifier`) instead of bespoke messaging/error flows.
- Start at `main.js` to understand how each piece initialises during dashboard bootstrap before diving into specific modules.
