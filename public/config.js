// Environment configuration for frontend
window.APP_CONFIG = {
  // Application identity
  APP_NAME: 'BDI Blocks World',
  
  // API configuration
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:3000`
    : window.location.origin,
  
  // Development vs production settings
  isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  
  // Authentication configuration
  AUTH: {
    REQUIRED: true,
    LOGIN_PAGE: 'login.html',
    MAIN_PAGE: 'index.html'
  },
  
  // Animation settings
  ANIMATION_DURATION: 550,
  
  // Block constraints
  MAX_BLOCKS: 26, // A-Z
  MAX_STACK_HEIGHT: 10,

  PLANNER: {
    MAX_ITERATIONS: 2500
  }
};