# BDI-Agent Frontend

This directory contains the frontend files for the BDI-Agent Blocks World Simulator.

## Structure

```
public/
├── index.html        # Main application interface
├── login.html        # User login page
├── signup.html       # User registration page
├── admin.html        # Admin user management panel
├── debug.html        # API testing utilities
├── script.js         # Main application logic (900 lines)
├── style.css         # Centralized styling with CSS variables
└── config.js         # Runtime configuration constants
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

### World Class (`script.js`)
Manages block state, positions, and animations:
```javascript
const world = new World();
world.addBlock('A');
world.moveBlock('A', 'B');
world.updatePositions();
```

### Animation System
CSS-based transitions with `.moving` class:
- Claw animation lifts, moves, and places blocks
- Synchronized with planner timeline updates
- Respects `ANIMATION_DURATION` from config

### Goal Parser
Tokenizes natural language goals:
```javascript
Input: "A on B on C"
Output: ['A', 'B', 'C', 'Table']
```

### Planner Integration
Sends block configuration to `/plan` endpoint:
```javascript
{
  stacks: [['A'], ['C', 'B']],
  goalChain: ['A', 'B', 'C'],
  plannerOptions: { maxIterations: 2500 }
}
```

Receives detailed telemetry:
```javascript
{
  moves: [{block, to, reason, actor}],
  iterations: 3,
  goalAchieved: true,
  intentionLog: [{cycle, moves, resultingStacks, beliefs}],
  beliefs: {onMap, clearBlocks, pendingRelation}
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

1. **Signup**: `signup.html` → `POST /users/signup` → Redirect to login
2. **Login**: `login.html` → `POST /login` → Store `{token, userId, username}` → Redirect to app
3. **Auth Guard**: `index.html` checks localStorage → Redirect to login if missing
4. **Logout**: Clear localStorage → Redirect to login

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
world.addBlock('D');
// Block appears with random pastel color
// Updates on-map and position calculations
```

### Executing Planner
```javascript
const goal = parseGoal('A on B on C');
const response = await fetch('/plan', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({stacks, goalChain: goal})
});
const plan = await response.json();
animateMoves(plan.moves);
```

### Saving World
```javascript
const userId = localStorage.getItem('userId');
await fetch('/worlds', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    name: 'My World',
    blocks: world.blocks,
    stacks: world.stacks,
    userId
  })
});
```

## Error Handling

### User-Facing Errors
```javascript
handleError(error, 'custom-message');
// Shows error in status-message div
// Auto-clears after 5s for non-errors
```

### Validation
- Duplicate blocks rejected
- Unknown goal tokens surface immediately
- Max block limit enforced (26)
- Empty goals prevented

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
- Check `ANIMATION_DURATION` in config
- Verify `.moving` class is removed after animation
- Ensure `world.updatePositions()` is called

**API calls failing:**
- Verify `API_BASE` in config matches backend URL
- Check CORS configuration in backend
- Confirm token is stored in localStorage

**Timeline not updating:**
- Ensure `markTimelineMove()` called after each move
- Check `intentionLog` in planner response
- Verify move reasons are preserved

**Authentication redirect loop:**
- Clear localStorage
- Check token expiry (7 days)
- Verify JWT_SECRET matches backend

For backend-specific issues, see `backend/README.md`.
