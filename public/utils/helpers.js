/**
 * Utility Helper Functions
 * 
 * General-purpose utility functions used across the application.
 */

/**
 * Generate a random pastel color for blocks
 * @returns {string} RGB color string
 */
export function randomColour() {
  const r = Math.floor((Math.random() * 127) + 128);
  const g = Math.floor((Math.random() * 127) + 128);
  const b = Math.floor((Math.random() * 127) + 128);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Show a message to the user
 * @param {string} text - Message text
 * @param {string} type - Message type ('info', 'success', 'error')
 */
export function showMessage(text, type = 'info') {
  const messagesElem = document.getElementById('messages');
  if (messagesElem) {
    const BASE = 'messages block mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200';
    const TYPE_MAP = {
      info: `${BASE} border-brand-primary/30 bg-brand-primary/10 text-brand-dark`,
      success: `${BASE} border-green-300 bg-green-50 text-green-700`,
      error: `${BASE} border-red-300 bg-red-50 text-red-600`
    };

    if (!text) {
      messagesElem.textContent = '';
      messagesElem.className = 'messages hidden';
      return;
    }

    messagesElem.textContent = text;
    messagesElem.className = TYPE_MAP[type] || TYPE_MAP.info;

    if (type !== 'error') {
      window.setTimeout(() => {
        if (messagesElem.textContent === text) {
          messagesElem.textContent = '';
          messagesElem.className = 'messages hidden';
        }
      }, 5000);
    }
  }
}

/**
 * Handle and display errors
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 */
export function handleError(error, context = '') {
  console.error(`Error in ${context}:`, error);
  
  let message = 'An unexpected error occurred';
  
  if (error.name === 'NetworkError' || !navigator.onLine) {
    message = 'Network connection error. Please check your internet connection.';
  } else if (error.message) {
    message = error.message;
  }
  
  showMessage(message, 'error');
}

/**
 * Format planner duration in MM:SS.CS format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatPlannerDuration(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${base}.${String(hundredths).padStart(2, '0')}`;
}

/**
 * Format belief snapshot for display
 * @param {Object} beliefs - Belief object from planner
 * @returns {string} Formatted belief string
 */
export function formatBeliefSnapshot(beliefs) {
  if (!beliefs || typeof beliefs !== 'object') {
    return '';
  }

  const pending = beliefs.pendingRelation
    ? `${beliefs.pendingRelation.block} -> ${beliefs.pendingRelation.destination}`
    : 'none';

  const clear = Array.isArray(beliefs.clearBlocks) && beliefs.clearBlocks.length > 0
    ? beliefs.clearBlocks.join(', ')
    : 'none';

  return `Pending relation: ${pending} | Clear blocks: ${clear}`;
}

