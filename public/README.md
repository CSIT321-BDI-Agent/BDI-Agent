# BDI-Agent Frontend

Modernised frontend for the BDI Blocks World simulator. Styling is handled exclusively with Tailwind CSS utilities and lightweight ES modules—no monolithic stylesheet required.

## Technology Stack

- HTML5 + ES modules (`public/utils`)
- Tailwind CSS built with the local CLI (`public/tailwind.css` → `public/assets/app.css`)
- Material Icons
- Node/Express backend (see `backend/`)

## Key Files

```
public/
├── index.html        # Dashboard + simulation UI
├── login.html        # Sign-in form
├── signup.html       # Registration form
├── admin.html        # Admin user management
├── debug.html        # Manual API testing helpers
├── tailwind.css      # Tailwind source (processed into assets/app.css)
├── assets/app.css    # Generated Tailwind bundle
└── utils/            # Shared browser modules
    ├── animation.js
    ├── auth.js
    ├── constants.js
    ├── helpers.js
    ├── navigation.js
    ├── profile.js
    ├── timeline.js
    └── ui-handlers.js
```

## Styling Notes

- All layout and components rely on Tailwind utility classes; the legacy `style.css` has been removed.
- Shared colours, shadows, and typefaces live in `tailwind.config.js`.
- Runtime scripts toggle Tailwind classes directly (e.g. `hidden`, `ring-2`, `border-brand-primary`) for state changes.
- Messages, alerts, and planner timelines now compose their visual states via small class maps in `helpers.js` and `timeline.js`.

## Build & Development

1. Install dependencies from the repository root:
   ```bash
   npm install
   ```
2. Generate the production stylesheet:
   ```bash
   npm run build:css
   ```
   The compiled bundle is written to `public/assets/app.css`.
3. During development, run the watcher for live rebuilds:
   ```bash
   npm run watch:css
   ```
4. Launch the backend (`backend/`) to serve API endpoints, then open `public/index.html` in a browser to interact with the simulator.

Adjust colours or spacing by editing `tailwind.config.js`, then rebuild the CSS bundle.
