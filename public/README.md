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
├── index.html        # Main application interface (505 lines, includes stats tracking)
├── login.html        # User login page (80 lines)
├── signup.html       # User registration page (82 lines)
├── admin.html        # Admin user management panel (79 lines)
├── debug.html        # API testing utilities (174 lines)
├── script.js.backup  # Legacy monolithic script (backup only)
├── style.css         # Centralized styling with CSS variables (1,580 lines, includes animations)
├── config.js         # Runtime configuration constants (30 lines)
└── utils/            # Modular JavaScript utilities (ES6 modules)
    ├── main.js           # Application entry point (30 lines)
    ├── auth.js           # Authentication utilities (284 lines)
    ├── constants.js      # Configuration & DOM references (42 lines)
    ├── helpers.js        # Utility functions (86 lines)
    ├── World.js          # World state management (142 lines)
    ├── animation.js      # Block/claw animation system (88 lines)
    ├── timeline.js       # Intention timeline & clock (274 lines, includes step tracking)
    ├── planner.js        # Backend API communication (37 lines)
    ├── persistence.js    # Save/load functionality (180 lines)
    └── ui-handlers.js    # Event handlers & simulation (285 lines, includes stats integration)
```

## Features

### Core Functionality
- **Block World Simulation**: Visual drag-and-drop interface for block stacking
- **Goal-Based Planning**: Natural language goal input ("A on B on C")
- **BDI Agent Execution**: Real-time planner execution with telemetry
- **Real-time Stats Tracking**: Live step counter, elapsed timer (100ms updates), and status monitoring
- **Material Icons**: Professional Google Material Icons for consistent UI
- **Modern Animations**: Scroll unfurl profile dropdown with cubic-bezier easing
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

The frontend JavaScript has been refactored from a single 908-line monolithic file into **10 specialized ES6 modules** for improved maintainability and code organization.

### Module Overview

| Module | Lines | Purpose | Key Exports |
|--------|-------|---------|-------------|
| **main.js** | 30 | Entry point & initialization | _(none, initializes app)_ |
| **auth.js** | 284 | Authentication & authorization | `login()`, `signup()`, `logout()`, `requireAuth()`, `getCurrentUser()`, 13+ functions |
| **constants.js** | 42 | Configuration & DOM refs | Constants, `DOM` object, `initializeClaw()` |
| **helpers.js** | 86 | Utility functions | `randomColour()`, `showMessage()`, `handleError()`, `formatPlannerDuration()` |
| **World.js** | 142 | World state management | `World` class |
| **animation.js** | 88 | Block/claw animations | `simulateMove()` |
| **timeline.js** | 274 | Timeline & planner clock + step tracking | Timeline rendering, clock functions, `markTimelineStep()` (8 exports) |
| **planner.js** | 37 | Backend communication | `requestBDIPlan()` |
| **persistence.js** | 180 | Save/load worlds | `saveWorld()`, `loadSelectedWorld()`, `refreshLoadList()`, `rebuildWorldFrom()` |
| **ui-handlers.js** | 285 | Event handlers + stats integration | `initializeHandlers()`, `runSimulation()`, `handleAddBlock()`, `setControlsDisabled()` |

### Benefits of Modularization

✅ **Better Organization**: Each module has a single, clear responsibility (avg 130 lines)  
✅ **Easier Maintenance**: Changes isolated to specific files, no ripple effects  
✅ **No Global Pollution**: Module-scoped state, zero global variables (verified)  
✅ **Clear Dependencies**: Explicit import/export relationships, no circular deps  
✅ **Improved Testability**: Small, focused modules are easier to unit test  
✅ **Better Documentation**: Each module has comprehensive header comments  
✅ **Zero Duplication**: Code quality audit confirmed no duplicate functions (Oct 2025)  
✅ **Type Safety**: JSDoc comments provide IntelliSense in modern editors

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

## Stats Tracking System

### Real-Time Statistics (October 2025)

The application includes comprehensive real-time statistics tracking during simulation:

**Stats Display Format:**
- **Total Steps**: Live counter incrementing with each claw cycle (4 cycles per move)
- **Time Elapsed**: Real-time timer with 100ms updates (displays as X.XXs format)
- **Status**: Current simulation state with color coding

**Status Values:**
- `Planning...` - Requesting plan from backend (default color)
- `Running...` - Executing moves with animation (default color)
- `Success` - Goal achieved (green text)
- `Failure` - Planner couldn't achieve goal within iteration limit (red text)
- `Unexpected (Error)` - Exception occurred during execution (orange text)
- `Unexpected (Illegal move)` - Invalid move detected (orange text)

**Global Functions** (in index.html):
```javascript
window._updateStats(steps, status)  // Update display and color-code status
window._startStatsTimer()           // Start elapsed time tracking
window._stopStatsTimer()            // Stop timer
window._resetStats()                // Reset all stats to "--"
window._incrementStep()             // Increment step counter (auto-called)
```

**Integration Points:**
- `ui-handlers.js` - Orchestrates stats lifecycle (start/stop timer, update status)
- `timeline.js` - Auto-increments step counter via `markTimelineStep()`
- `animation.js` - Each of 4 claw actions counts as one step

**4-Step Cycle Model:**
Each logical move consists of 4 distinct claw actions:
1. Move claw to source block position
2. Pick up block
3. Move claw to destination position
4. Drop block

Total Steps = Moves × 4 cycles per move

See [STATS_AND_PROFILE_UPDATES.md](../STATS_AND_PROFILE_UPDATES.md) for complete documentation.

## Material Icons Integration

### Professional Icon Library (October 2025)

The application uses **Google Material Icons** for consistent, professional UI:

**CDN Link** (in index.html):
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
```

**Icons Used:**
| Icon | Usage | Location |
|------|-------|----------|
| `account_circle` | User avatar | Profile button |
| `expand_more` | Dropdown indicator | Profile button |
| `person` | View Profile | Profile menu |
| `admin_panel_settings` | Admin Dashboard | Profile menu (admin only) |
| `logout` | Sign out | Profile menu |
| `login` | Sign in | Profile menu |
| `person_add` | Create account | Profile menu |

**Styling** (in style.css):
- Teal color (#14b8a6) for consistency
- Hover scale effect (1.0 → 1.1)
- Smooth transitions

**Browser Compatibility:**
- Icons load from CDN (requires internet)
- Cached after first load
- Fallback to text if CDN unavailable

## Profile Dropdown Animation

### Scroll Unfurl Effect (October 2025)

The profile dropdown features a smooth "scroll unfurling" animation:

**Animation Properties:**
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` for professional feel
- **Duration**: 0.4s transition
- **Technique**: Combines `max-height` (0 → 400px) + `scaleY(0 → 1)` transforms
- **Transform Origin**: `top center` for natural unfurl from top

**Staggered Menu Items:**
Menu items cascade in with sequential delays:
- 1st item: 0.05s delay
- 2nd item: 0.10s delay
- 3rd item: 0.15s delay
- 4th item: 0.20s delay

**CSS Implementation** (style.css):
```css
.profile-menu {
  max-height: 0;
  transform: translateY(-10px) scaleY(0);
  transform-origin: top center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.profile-menu.active {
  max-height: 400px;
  transform: translateY(0) scaleY(1);
}

@keyframes slideIn {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

**Admin Menu Item:**
- Conditionally displayed based on `localStorage.getItem('role') === 'admin'`
- Uses `admin_panel_settings` Material Icon
- Links to `admin.html`
- Automatically shown/hidden by `updateProfileDisplay()` function

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
- Ensure `markTimelineStep()` called in `animation.js` after each claw action
- Check `intentionLog` in planner response
- Verify move reasons are preserved in `planner.js`
- Check `timeline.js` state management

**Stats not updating:**
- Check browser console for JavaScript errors
- Verify `window._updateStats` is defined (view page source)
- Ensure `window._incrementStep()` is called from `markTimelineStep()`
- Check planner execution calls stats functions in `ui-handlers.js`
- Verify timer interval is running (no browser throttling)

**Material Icons not showing:**
- Check CDN link in Network tab (should load fonts.googleapis.com)
- Verify no content security policy blocking fonts
- Check for AdBlocker interference with Google CDN
- Test in incognito mode to rule out extension interference

**Profile dropdown animation stuttering:**
- Check browser supports CSS transitions
- Verify no conflicting CSS from browser extensions
- Test in incognito mode
- Check for high CPU usage during animation

**Admin menu not appearing:**
- Open DevTools \u2192 Application \u2192 Local Storage
- Verify `role` key exists with value `admin`
- Check `updateProfileDisplay()` is called after login
- Clear cache and re-login if role was recently changed

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
