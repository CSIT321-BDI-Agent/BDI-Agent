/**
 * Simulation statistics utilities
 *
 * Responsible for tracking and displaying the simulation statistics panel
 * (steps taken, elapsed time, status badges).
 */

const STATUS_TONE_CLASSES = {
  default: 'text-brand-dark',
  info: 'text-state-info',
  success: 'text-state-success',
  error: 'text-state-error'
};

let statStepsElem = null;
let statTimeElem = null;
let statStatusElem = null;

let totalSteps = 0;
let simulationStartTime = null;
let statsUpdateInterval = null;
let initialized = false;

/**
 * Initialize statistics UI bindings
 */
export function initializeStatsUI({
  stepsSelector = '#stat-steps',
  timeSelector = '#stat-time',
  statusSelector = '#stat-status'
} = {}) {
  statStepsElem = document.querySelector(stepsSelector);
  statTimeElem = document.querySelector(timeSelector);
  statStatusElem = document.querySelector(statusSelector);
  initialized = Boolean(statStepsElem && statTimeElem && statStatusElem);
  resetStats();
}

/**
 * Update statistics display values
 * @param {number} [steps] - Total steps (optional)
 * @param {string} [status] - Status message (optional)
 */
export function updateStats(steps, status) {
  if (!initialized) return;

  if (typeof steps === 'number' && Number.isFinite(steps)) {
    totalSteps = steps;
    statStepsElem.textContent = String(steps);
  }

  if (typeof status === 'string') {
    const normalized = status.trim();
    statStatusElem.textContent = normalized;
    applyStatusTone(resolveStatusTone(normalized));
  }
}

/**
 * Start tracking elapsed simulation time
 */
export function startStatsTimer() {
  if (!initialized) return;

  simulationStartTime = Date.now();
  totalSteps = 0;
  statStepsElem.textContent = '0';
  statStatusElem.textContent = 'Running';
  applyStatusTone('info');

  if (statsUpdateInterval) clearInterval(statsUpdateInterval);
  statsUpdateInterval = window.setInterval(() => {
    if (!simulationStartTime) return;
    const elapsed = Date.now() - simulationStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const ms = Math.floor((elapsed % 1000) / 10);
    statTimeElem.textContent = `${seconds}.${String(ms).padStart(2, '0')}s`;
  }, 100);
}

/**
 * Stop the elapsed time tracker
 */
export function stopStatsTimer() {
  if (statsUpdateInterval) {
    clearInterval(statsUpdateInterval);
    statsUpdateInterval = null;
  }
}

/**
 * Reset statistics values to their defaults
 */
export function resetStats() {
  totalSteps = 0;
  simulationStartTime = null;
  if (!initialized) return;

  stopStatsTimer();
  statStepsElem.textContent = '--';
  statTimeElem.textContent = '--';
  statStatusElem.textContent = '--';
  applyStatusTone('default');
}

/**
 * Increment the step counter by one
 */
export function incrementStep() {
  if (!initialized) return;
  totalSteps += 1;
  statStepsElem.textContent = String(totalSteps);
}

/**
 * Resolve an appropriate text colour for the status badge
 * @param {string} status
 * @returns {string}
 */
function resolveStatusTone(status) {
  const value = status.toLowerCase();
  if (value.includes('success')) {
    return 'success';
  }
  if (value.includes('fail') || value.includes('illegal') || value.includes('error')) {
    return 'error';
  }
  if (value.includes('run')) {
    return 'info';
  }
  return 'default';
}

function applyStatusTone(tone = 'default') {
  if (!statStatusElem) return;
  Object.values(STATUS_TONE_CLASSES).forEach(cls => statStatusElem.classList.remove(cls));
  const applied = STATUS_TONE_CLASSES[tone] || STATUS_TONE_CLASSES.default;
  statStatusElem.classList.add(applied);
}
