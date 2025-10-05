# BDI-Agent Fron├── utils/            # Modular JavaScript utilities
    ├── main.js           # Application entry point (40 lines)
    ├── auth.js           # Authentication utilities (300 lines)
    ├── constants.js      # Configuration & DOM references (54 lines)
    ├── helpers.js        # Utility functions (92 lines)
    ├── World.js          # World state management (155 lines)
    ├── animation.js      # Block/claw animation system (101 lines)
    ├── timeline.js       # Intention timeline & clock (265 lines)
    ├── planner.js        # Backend API communication (40 lines)
    ├── persistence.js    # Save/load functionality (176 lines)
    └── ui-handlers.js    # Event handlers & simulation (165 lines)is directory contains the frontend files for the BDI-Agent Blocks World Simulator.

## Structure

```
public/
├── index.html        # Main application interface
├── login.html        # User login page
├── signup.html       # User registration page
├── admin.html        # Admin user management panel
├── debug.html        # API testing utilities
├── script.js         # Legacy monolithic script (backup)
├── style.css         # Centralized styling with CSS variables
├── config.js         # Runtime configuration constants
└── utils/            # Modular JavaScript utilities
    ├── main.js           # Application entry point (40 lines)
    ├── constants.js      # Configuration & DOM references (54 lines)
    ├── helpers.js        # Utility functions (92 lines)
    ├── World.js          # World state management (155 lines)
    ├── animation.js      # Block/claw animation system (101 lines)
    ├── timeline.js       # Intention timeline & clock (265 lines)
    ├── planner.js        # Backend API communication (40 lines)
    ├── persistence.js    # Save/load functionality (176 lines)
    └── ui-handlers.js    # Event handlers & simulation (165 lines)
```

## Features

### Core Functionality
- **Block World Simulation**: Visual drag-and-drop interface for block stacking
- **Goal-Based Planning**: Natural language goal input ("A on B on C")
- **BDI Agent Execution**: Real-time planner execution with telemetry
- **Animation System**: Smooth robotic claw animations with CSS transitions
- **Planner Timeline**: Visual timeline showing each reasoning cycle
- **World Persistence**: Save/load configurations with MongoDB backend

### User Management
- **Authentication**: JWT-based login/signup system
- **Admin Panel**: User role management (promote/demote/delete users)
- **Session Management**: Persistent login via localStorage

### Developer Tools
- **Debug Interface**: Manual API endpoint testing
- **Error Surfacing**: Clear error messages for validation/planner failures
- **Planner Clock**: Real-time duration tracking per simulation run

## Modular Architecture

The frontend JavaScript has been refactored from a single 908-line monolithic file into **9 specialized ES6 modules** for improved maintainability and code organization.

### Module Overview

| Module | Lines | Purpose | Key Exports |
|--------|-------|---------|-------------|
| **main.js** | 40 | Entry point & initialization | _(none, initializes app)_ |
| **auth.js** | 300 | Authentication & authorization | `login()`, `signup()`, `logout()`, `requireAuth()`, `getCurrentUser()` |
| **constants.js** | 54 | Configuration & DOM refs | Constants, `DOM` object, `initializeClaw()` |
| **helpers.js** | 92 | Utility functions | `randomColour()`, `showMessage()`, `handleError()` |
| **World.js** | 155 | World state management | `World` class |
| **animation.js** | 101 | Block/claw animations | `simulateMove()` |
| **timeline.js** | 265 | Timeline & planner clock | Timeline rendering & clock functions |
| **planner.js** | 40 | Backend communication | `requestBDIPlan()` |
| **persistence.js** | 176 | Save/load worlds | `saveWorld()`, `loadSelectedWorld()` |
| **ui-handlers.js** | 165 | Event handlers | `initializeHandlers()`, `runSimulation()` |

### Benefits of Modularization

✅ **Better Organization**: Each module has a single, clear responsibility  
✅ **Easier Maintenance**: Changes isolated to specific files  
✅ **No Global Pollution**: Module-scoped state, zero global variables  
✅ **Clear Dependencies**: Explicit import/export relationships  
✅ **Improved Testability**: Small, focused modules are easier to test  
✅ **Better Documentation**: Each module has comprehensive header comments

### Import Chain

```
index.html
├── utils/auth.js (auth guard)
│   └── constants.js (for API_BASE config)
└── utils/main.js (entry point)
    ├── constants.js (leaf - no dependencies)
    ├── World.js
    │   ├── constants.js
    │   └── helpers.js
    ├── timeline.js
    │   ├── constants.js
    │   └── helpers.js
    └── ui-handlers.js
        ├── constants.js
        ├── helpers.js
        ├── timeline.js
        ├── planner.js
        ├── animation.js
        │   ├── constants.js
        │   ├── helpers.js
        │   └── timeline.js
        └── persistence.js
            ├── constants.js
            ├── helpers.js
            └── auth.js (for getCurrentUser)

login.html / signup.html
└── utils/auth.js
    └── constants.js

admin.html
└── utils/auth.js
    └── constants.js
```

**No circular dependencies** - Clean dependency graph with `constants.js` as the only leaf module.

## Configuration

All runtime configuration is centralized in `config.js`:

```javascript
window.APP_CONFIG = {
  APP_NAME: 'BDI Blocks World',
  API_BASE: 'http://localhost:3000',  // Auto-detects in development
  MAX_BLOCKS: 26,                      // Block limit (A-Z)
  ANIMATION_DURATION: 800,             // Animation timing (ms)
  PLANNER: {
    MAX_ITERATIONS: 2500,              // Default iteration cap
    HARD_CAP: 5000                     // Server hard limit
  },
  AUTH: {
    TOKEN_KEY: 'token',                // localStorage key
    USER_ID_KEY: 'userId',
    USERNAME_KEY: 'username'
  }
};
```

## Technology Stack

- **Vanilla JavaScript**: No build step, no bundler
- **CSS Variables**: 50+ custom properties for theming
- **ES5 Compatible**: Works in all modern browsers
- **LocalStorage**: Client-side session persistence
- **Fetch API**: RESTful communication with backend

## Key Components

### World Class (`utils/World.js`)
Manages block state, positions, and animations:
```javascript
import { World } from './utils/World.js';

const world = new World();
world.addBlock('A', 'Table');
world.moveBlock('A', 'B');
world.updatePositions();
world.getCurrentStacks();  // Get current configuration
```

### Animation System (`utils/animation.js`)
CSS-based transitions with `.moving` class:
```javascript
import { simulateMove } from './utils/animation.js';

simulateMove(world, {block: 'A', to: 'B'}, () => {
  console.log('Move complete');
});
```
- Claw animation lifts, moves, and places blocks
- Synchronized with planner timeline updates via `markTimelineMove()`
- Respects `ANIMATION_DURATION` from config
- Async callback pattern for sequential moves

### Goal Parser (`utils/ui-handlers.js`)
Tokenizes natural language goals:
```javascript
const goalInput = "A on B on C";
const goalTokens = goalInput
  .split(/\s*on\s*/i)
  .map(t => t.trim().toUpperCase())
  .filter(Boolean);
// Output: ['A', 'B', 'C']
```
Validates blocks exist before planning.

### Planner Integration (`utils/planner.js`)
Sends block configuration to `/plan` endpoint:
```javascript
import { requestBDIPlan } from './utils/planner.js';

const response = await requestBDIPlan(
  [['A'], ['C', 'B']],           // stacks
  ['A', 'B', 'C'],                // goalChain
  { maxIterations: 2500 }         // options
);
```

Receives detailed telemetry:
```javascript
{
  moves: [{block, to, reason, actor}],
  iterations: 3,
  goalAchieved: true,
  intentionLog: [{cycle, moves, resultingStacks, beliefs}],
  beliefs: {onMap, clearBlocks, pendingRelation},
  plannerOptionsUsed: {maxIterations: 2500}
}
```

## Styling Architecture

### CSS Variables (style.css)
Centralized design tokens:
```css
:root {
  /* Colors */
  --color-primary: #4A90E2;
  --color-bg-dark: #1a1a1a;
  
  /* Breakpoints */
  --breakpoint-tablet: 768px;
  --breakpoint-mobile: 480px;
  
  /* Animation */
  --transition-fast: 0.2s;
  --transition-smooth: 0.3s;
}
```

### Component Classes
- `.btn`, `.btn-secondary`, `.btn-sm` - Button variants
- `.form-group`, `.form-field` - Unified form elements
- `.timeline-item`, `.timeline-move` - Planner timeline
- `.status-message`, `.error-message` - User feedback

## Authentication Flow

All authentication is now handled by the centralized `utils/auth.js` module:

1. **Signup**: `signup.html` → `signup()` from auth.js → Auto-stores token → Redirect to app
2. **Login**: `login.html` → `login()` from auth.js → Auto-stores token → Redirect to app (or admin panel)
3. **Auth Guard**: Pages call `requireAuth()` or `requireAdmin()` → Redirect to login if not authenticated
4. **Logout**: `logout()` from auth.js → Clear all data → Redirect to login
5. **API Calls**: Use `authenticatedFetch()` or `getAuthHeaders()` for automatic token inclusion

### Key Functions

```javascript
import { 
  login, signup, logout,           // Authentication actions
  requireAuth, requireAdmin,        // Auth guards for pages
  getCurrentUser, isAuthenticated,  // User state checks
  authenticatedFetch               // API helper
} from './utils/auth.js';
```

See [AUTH_MODULE.md](AUTH_MODULE.md) for complete documentation.

## Development Workflow

### Local Development
Frontend is served by the backend via `express.static()`:
```
http://localhost:3000 → public/index.html
```

### Hot Reload
Edit files in `public/` and refresh browser - no build step needed.

### Docker Development
In `docker-compose.dev.yml`, frontend is mounted as a volume:
```yaml
volumes:
  - ./public:/app/public
```
Changes reflect immediately without rebuilding container.

## Common Tasks

### Adding a Block
```javascript
import { World } from './utils/World.js';

const world = new World();
world.addBlock('D', 'Table');
// Block appears with random pastel color
// Updates on-map and position calculations
```

### Executing Planner
```javascript
import { requestBDIPlan } from './utils/planner.js';
import { runSimulation } from './utils/ui-handlers.js';

// Request plan from backend
const plannerResponse = await requestBDIPlan(
  world.getCurrentStacks(),
  ['A', 'B', 'C'],
  { maxIterations: 2500 }
);

// Execute with animation
if (plannerResponse.goalAchieved) {
  await runSimulation(world);
}
```

### Saving World
```javascript
import { saveWorld } from './utils/persistence.js';

// Prompts user for world name, then saves
await saveWorld(world);
// Automatically refreshes load list on success
```

### Loading World
```javascript
import { loadSelectedWorld, refreshLoadList } from './utils/persistence.js';

// Refresh dropdown
await refreshLoadList();

// Load selected world (rebuilds from saved data)
await loadSelectedWorld(world);
```

## Error Handling

### User-Facing Errors (`utils/helpers.js`)
```javascript
import { handleError, showMessage } from './utils/helpers.js';

// Generic error handling with context
handleError(error, 'saving world');

// Custom messages with types
showMessage('World saved!', 'success');  // Auto-clears after 5s
showMessage('Invalid block name', 'error');  // Persists
showMessage('Planning in progress...', 'info');  // Auto-clears
```

### Validation
- Duplicate blocks rejected
- Unknown goal tokens surface immediately
- Max block limit enforced (26)
- Empty goals prevented

## Module Development

### Adding a New Module

1. **Create module file** in `public/utils/`:
```javascript
/**
 * Module Name
 * 
 * Brief description of module purpose
 */

import { DOM } from './constants.js';

export function myFunction() {
  // Implementation
}
```

2. **Import in parent module**:
```javascript
import { myFunction } from './my-module.js';
```

3. **Update documentation**:
- Add to module table in README
- Document exports and usage
- Update import chain diagram if needed

### Module Guidelines

- ✅ **Single Responsibility**: Each module should have one clear purpose
- ✅ **Explicit Exports**: Only export what's needed by other modules
- ✅ **Import from constants.js**: Use `DOM` object for element references
- ✅ **Document Functions**: Add JSDoc comments for exports
- ✅ **Avoid Circular Deps**: Keep dependency graph acyclic
- ✅ **Module-Scoped State**: Use module scope, not global variables

### Dependency Rules

1. **constants.js** is a leaf module (no imports)
2. **helpers.js** only imports from constants.js
3. **World.js** only imports from constants.js and helpers.js
4. Higher-level modules (ui-handlers, persistence) can import anything
5. **No circular dependencies** between modules

## Testing

### Manual Testing Checklist
1. ✅ Signup → Login → Blocks load
2. ✅ Add blocks (A, B, C)
3. ✅ Set goal "A on B on C"
4. ✅ Watch planner timeline populate
5. ✅ Clock stops + success toast
6. ✅ Save world → Refresh → Load world
7. ✅ Test planner failures (duplicates, unknown blocks)
8. ✅ Admin panel (if admin role)

### Debug Interface
Use `debug.html` for manual endpoint checks:
- Test authentication
- Verify API responses
- Check error handling

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support
- **IE11**: ⚠️ ES5 compatible, but JWT/Fetch polyfills may be needed

## Performance Notes

- **Animation Queue**: Moves execute sequentially to prevent desyncs
- **LocalStorage**: Limited to ~5MB per origin
- **API Throttling**: No built-in rate limiting (add if needed)
- **Block Limit**: 26 blocks (A-Z) enforced client-side

## Accessibility

- **ARIA Labels**: Added to interactive elements
- **Keyboard Navigation**: Tab order preserved
- **Color Contrast**: Meets WCAG AA standards
- **Focus Indicators**: Visible on all controls

## Troubleshooting

**Blocks not animating:**
- Check `ANIMATION_DURATION` in config.js
- Verify `.moving` class is removed in `animation.js`
- Ensure `world.updatePositions()` is called
- Check browser console for errors in `simulateMove()`

**API calls failing:**
- Verify `API_BASE` in config.js matches backend URL
- Check CORS configuration in backend
- Confirm token is stored in localStorage
- Check `planner.js` for correct endpoint usage

**Timeline not updating:**
- Ensure `markTimelineMove()` called in `animation.js` after each move
- Check `intentionLog` in planner response
- Verify move reasons are preserved in `planner.js`
- Check `timeline.js` state management

**Module import errors:**
- Verify `<script type="module">` in index.html
- Check all import paths use correct relative paths
- Ensure all exports match imports (case-sensitive)
- Check browser console for 404 errors on module files

**Authentication redirect loop:**
- Clear localStorage
- Check token expiry (7 days)
- Verify JWT_SECRET matches backend
- Check auth guard in index.html

**World state desync:**
- Verify `World.js` methods update both `stacks` and `on` map
- Check `persistence.js` rebuilds correctly
- Ensure `getCurrentStacks()` returns deep copies

For backend-specific issues, see `backend/README.md`.  
For detailed modularization info, see `MODULARIZATION_VERIFICATION.md`.
