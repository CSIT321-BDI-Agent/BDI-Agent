// Environment configuration for frontend
window.APP_CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:3000`
    : window.location.origin,
  
  // Development vs production settings
  isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  
  // Animation settings
  ANIMATION_DURATION: 550,
  
  // Block constraints
  MAX_BLOCKS: 26, // A-Z
  MAX_STACK_HEIGHT: 10,

  PLANNER: {
    AGENT_COUNT: 2,
    NEGOTIATION: 'prefer-stack'
  }
};