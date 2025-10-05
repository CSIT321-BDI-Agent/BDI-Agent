/**
 * Main Application Entry Point
 * 
 * Initializes the BDI Blocks World application and orchestrates all modules
 */

import { initializeClaw } from './constants.js';
import { World } from './World.js';
import { resetIntentionTimeline, updatePlannerClockDisplay } from './timeline.js';
import { initializeHandlers } from './ui-handlers.js';

/**
 * Initialize the application
 */
function initializeApp() {
  // Initialize claw graphics
  initializeClaw();

  // Create world instance
  const world = new World();

  // Initialize timeline display
  resetIntentionTimeline();
  updatePlannerClockDisplay('--:--');

  // Set up UI event handlers
  initializeHandlers(world);

  console.log('BDI Blocks World application initialized');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
