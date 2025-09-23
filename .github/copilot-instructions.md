# BDI-Agent Copilot Instructions

This is a **Blocks World simulation with BDI (Belief-Desire-Intention) planning** - a classic AI environment where agents manipulate colored blocks to achieve goal configurations.

## Architecture Overview

**Full-stack Node.js application** with Express backend and vanilla JavaScript frontend:
- `server.js`: Express API with MongoDB integration for user authentication and world persistence
- `public/`: Static frontend files served directly by Express
- **No build process** - vanilla HTML/CSS/JS with inline styles and embedded scripts

## Key Components & Data Flow

### Backend (`server.js`)
- **User Management**: bcrypt-hashed authentication with MongoDB User collection
- **World Persistence**: MongoDB World collection stores block configurations per user
- **Duplicate Route Issue**: `/worlds` POST endpoint appears twice (lines ~24 and ~42) - second one overrides first
- **Session Management**: Stateless - client stores `userId` in localStorage

### Frontend Architecture
- **`public/index.html`**: Main simulation interface with embedded CSS/JS
- **`public/script.js`**: Core simulation engine and API integration
- **`public/login.html`** & **`public/signup.html`**: Authentication forms

### Blocks World Engine (`script.js`)
- **World Class**: Manages block positions, stacks, and colors
- **BDI Planning**: `computePlan()` implements goal-stack planning algorithm
- **Animation System**: CSS transitions with `simulateMove()` for visual feedback
- **State Representation**: `stacks` array of arrays, `on` object for block relationships

## Critical Patterns

### Authentication Flow
```javascript
// Client stores credentials locally after login/signup
localStorage.setItem('userId', data.userId);
localStorage.setItem('username', username);

// API calls include userId for data isolation
const res = await fetch(`${API_BASE}/worlds?userId=${userId}`);
```

### World State Management
```javascript
// Core state structures in World class
this.stacks = [];      // [[A], [B, C]] - stacks of blocks
this.on = {};          // {A: 'Table', B: 'Table', C: 'B'} - what each block sits on
this.blocks = [];      // [A, B, C] - all blocks in world
this.colours = {};     // {A: 'rgb(r,g,b)'} - block colors
```

### Planning Algorithm
Uses goal-stack planning with `clearBlock()` and `putOn()` operations. Plans are arrays of move objects: `{block: 'A', to: 'B'}`.

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Set environment variables (optional)
# PORT=3000
# MONGODB_URI=mongodb://localhost:27017/blocks_world

# Start server
node server.js
```

### Database Setup
- MongoDB required (defaults to `mongodb://localhost:27017/blocks_world`)
- Two collections: `users` and `worlds`
- No migration scripts - schemas defined inline with Mongoose

### Frontend Development
- **No build step** - edit files directly in `public/`
- **Hardcoded API_BASE**: `http://localhost:3000` in `script.js` line 290
- **Inline styles**: CSS embedded in HTML files, not separate stylesheets for some components

## Integration Points

### API Endpoints
- `POST /users/signup` - User registration
- `POST /login` - User authentication  
- `POST /worlds` - Save world state (user-scoped)
- `GET /worlds/:id?userId=` - Load specific world
- `GET /worlds?userId=` - List user's worlds (missing implementation)

### Client-Server State Sync
- **Optimistic Updates**: Frontend updates immediately, saves to backend asynchronously
- **Error Handling**: Basic alerts on API failures
- **State Persistence**: Full world state (blocks, stacks, colors) serialized to MongoDB

## Project-Specific Conventions

### Block Naming
- Single uppercase letters only (A-Z validation in `addBlockBtn` event)
- Case-insensitive input converted to uppercase
- Unique block names enforced

### Animation System
- **Claw Visualization**: DOM element follows blocks during moves
- **CSS Transitions**: 550ms duration for all block movements
- **Moving Class**: Applied during transitions for visual effects

### Goal Syntax
- Natural language: "A on B on C" parsed to planning chain
- Case-insensitive with "on" keyword splitting
- Minimum 2 blocks required for valid goals

## Common Issues & Debugging

### Duplicate Route Problem
Server has two `/worlds` POST routes - check line 24 vs 42 when debugging save issues.

### CORS Configuration
`cors()` middleware enabled for all origins - may need restriction for production.

### LocalStorage Dependencies
Authentication and world loading break if localStorage is cleared - no graceful fallback.

### MongoDB Connection
Server exits on MongoDB connection failure (line 21) - ensure database is running locally.