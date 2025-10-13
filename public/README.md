# Frontend (public/)

Browser-facing portion of the Blocks World simulator. The dashboard UI now serves as the canonical reference for layout—other pages (admin, auth, debug) reuse the same design tokens, typography, and component patterns.

---

## Pages

- `index.html` – main simulator dashboard (planner controls, saved worlds, stats, timeline)
- `admin.html` – admin panel shell using the same responsive sidebar & profile menu
- `profile.html` � authenticated account overview with editable credentials
- `login.html` / `signup.html` – compact auth cards with shared message styling
- `debug.html` – lightweight developer utilities for manual API checks

Each page depends on the generated Tailwind bundle (`assets/app.css`) and the runtime modules in `utils/`.

---

## Modules of Note (`public/utils/`)

| Module | Responsibility |
|--------|----------------|
| `main.js` | Boots the dashboard, wiring world state, handlers, and persistence |
| `ui-handlers.js` | Simulation controller (planner requests, animation sequence, save/load) |
| `persistence.js` | Saves worlds with stacks, colours, and intention timelines |
| `timeline.js` | Renders and restores the intention timeline + planner clock |
| `stats.js` | Tracks steps/time/status during simulation runs |
| `auth.js` | Login/signup helpers, JWT storage, admin guard |
| `navigation.js` | Mobile menu & collapsible sidebar |
| `profile.js` | Shared profile button/menu logic |
| `helpers.js` | Message helpers, checksum utility, etc. |

---

## Styling

- Tailwind utilities only—no bespoke stylesheet beyond the generated bundle.
- Source file: `tailwind.css`; output written to `assets/app.css`.
- Common tokens live in `tailwind.config.js` (brand palette, shadows, typography).
- Run `npm run build:css` for a one-off build or `npm run watch:css` for live updates.

Cards, alerts, and timeline entries share class maps defined in the modules (`helpers.js`, `timeline.js`), so adjust there when tweaking colours/states.

---

## Development Workflow

1. Install dependencies at the repo root: `npm install`
2. Tailwind:
   ```bash
   npm run watch:css   # rebuild on change
   # or
   npm run build:css   # production build
   ```
3. Run the backend (Docker or manual) so API endpoints are available.
4. Open `public/index.html` in a browser (or serve via the Express static middleware when running the backend).

The simulator writes planner results, world timelines, and UI stats to the browser; the backend persists the same data for reloads. Keep the saved-world schema (`models/World.js`) and `persistence.js` in sync when evolving the UI.

---

Need more backend details? See [`../backend/README.md`](../backend/README.md). For overall project setup, refer to the [root README](../README.md).

