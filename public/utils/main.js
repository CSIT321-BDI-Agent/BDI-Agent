/**
 * Main Application Entry Point
 * 
 * Initializes the BDI Blocks World application and orchestrates all modules
 */

import { initializeClaw, DOM } from './constants.js';
import { World } from './World.js';
import { resetIntentionTimeline, updatePlannerClockDisplay } from './timeline.js';
import { initializeHandlers } from './ui-handlers.js';
import { saveWorld, refreshLoadList } from './persistence.js';

/**
 * Initialize the application
 */
function initializeApp() {
  // Initialize claw graphics
  initializeClaw();

  // Create world instance with container element
  const world = new World(DOM.world());

  // Expose world globally for inline scripts
  window.world = world;

  // Expose persistence functions globally for onclick handlers
  window.saveWorld = () => saveWorld(world);
  window.refreshLoadList = refreshLoadList;

  // Initialize timeline display
  resetIntentionTimeline();
  updatePlannerClockDisplay('--:--');

  // Set up UI event handlers
  initializeHandlers(world);
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
