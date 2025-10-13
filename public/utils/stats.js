/**
 * Simulation statistics utilities
 *
 * Responsible for tracking and displaying the simulation statistics panel
 * (steps taken, elapsed time, status badges).
 */

const STATUS_TONE_CLASSES = {
  default: 'text-brand-dark',
  info: 'text-brand-primary',
  success: 'text-emerald-600',
  error: 'text-red-600'
};

const DEFAULT_STATUS = '--';

let statStepsElem = null;
let statTimeElem = null;
let statStatusElem = null;

let statsState = {
  steps: null,
  status: DEFAULT_STATUS,
  elapsedMs: 0,
  running: false
};

let simulationStartTime = null;
let statsUpdateInterval = null;
let initialized = false;

const formatElapsed = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) {
    return '--';
  }
  const seconds = Math.floor(ms / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${String(centiseconds).padStart(2, '0')}s`;
};

const parseElapsed = (value) => {
  if (Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === '--') {
    return null;
  }
  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2}))?s$/i);
  if (!match) {
    return null;
  }
  const seconds = Number.parseInt(match[1], 10);
  const centiseconds = match[2] ? Number.parseInt(match[2].padEnd(2, '0'), 10) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(centiseconds)) {
    return null;
  }
  return (seconds * 1000) + (centiseconds * 10);
};

const clearTimer = () => {
  if (statsUpdateInterval) {
    clearInterval(statsUpdateInterval);
    statsUpdateInterval = null;
  }
};

const renderStats = () => {
  if (!initialized) return;

  const stepsText = statsState.steps == null ? '--' : String(statsState.steps);
  statStepsElem.textContent = stepsText;

  const elapsedDisplay = statsState.steps == null && statsState.elapsedMs === 0
    ? '--'
    : formatElapsed(statsState.elapsedMs);
  statTimeElem.textContent = elapsedDisplay;

  const statusText = statsState.status && statsState.status.trim().length > 0
    ? statsState.status
    : DEFAULT_STATUS;
  statStatusElem.textContent = statusText;
  applyStatusTone(resolveStatusTone(statusText));
};

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
  if (!initialized) return;
  statsState = {
    steps: null,
    status: DEFAULT_STATUS,
    elapsedMs: 0,
    running: false
  };
  renderStats();
}

/**
 * Update statistics display values
 * @param {number} [steps] - Total steps (optional)
 * @param {string} [status] - Status message (optional)
 */
export function updateStats(steps, status) {
  if (!initialized) return;

  if (typeof steps === 'number' && Number.isFinite(steps)) {
    statsState.steps = Math.max(0, Math.floor(steps));
  }

  if (typeof status === 'string') {
    const normalized = status.trim();
    statsState.status = normalized || DEFAULT_STATUS;
  }

  renderStats();
}

/**
 * Start tracking elapsed simulation time
 */
export function startStatsTimer() {
  if (!initialized) return;

  clearTimer();
  statsState.steps = 0;
  statsState.status = 'Running';
  statsState.elapsedMs = 0;
  statsState.running = true;
  simulationStartTime = Date.now();
  renderStats();

  statsUpdateInterval = window.setInterval(() => {
    if (!simulationStartTime) return;
    statsState.elapsedMs = Date.now() - simulationStartTime;
    renderStats();
  }, 100);
}

/**
 * Stop the elapsed time tracker
 */
export function stopStatsTimer(finalize = true) {
  if (!initialized) return;
  if (finalize && simulationStartTime) {
    statsState.elapsedMs = Date.now() - simulationStartTime;
  }
  clearTimer();
  statsState.running = false;
  simulationStartTime = null;
  renderStats();
}

/**
 * Reset statistics values to their defaults
 */
export function resetStats() {
  if (!initialized) return;
  clearTimer();
  simulationStartTime = null;
  statsState = {
    steps: null,
    status: DEFAULT_STATUS,
    elapsedMs: 0,
    running: false
  };
  renderStats();
}

/**
 * Increment the step counter by one
 */
export function incrementStep() {
  if (!initialized) return;
  if (statsState.steps == null) {
    statsState.steps = 0;
  }
  statsState.steps += 1;
  renderStats();
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

/**
 * Return a lightweight snapshot of the current statistics panel
 * @returns {{steps:number,timeElapsed:string,timeElapsedMs:number,status:string}|null}
 */
export function getStatsSnapshot() {
  if (!initialized) return null;

  const hasMeaningfulData =
    statsState.steps != null ||
    (statsState.status && statsState.status !== DEFAULT_STATUS) ||
    statsState.elapsedMs > 0;

  if (!hasMeaningfulData) {
    return null;
  }

  return {
    steps: statsState.steps ?? 0,
    timeElapsedMs: Math.max(0, Math.floor(statsState.elapsedMs)),
    timeElapsed: formatElapsed(statsState.elapsedMs),
    status: statsState.status || DEFAULT_STATUS
  };
}

/**
 * Restore statistics panel from a saved snapshot
 * @param {{steps?:number,timeElapsed?:string,timeElapsedMs?:number,status?:string}|null} snapshot
 */
export function restoreStatsFromSnapshot(snapshot) {
  if (!initialized) return;
  clearTimer();

  if (!snapshot || typeof snapshot !== 'object') {
    resetStats();
    return;
  }

  const steps = Number.isFinite(snapshot.steps) ? Math.max(0, Math.floor(snapshot.steps)) : null;
  const elapsedMs = parseElapsed(snapshot.timeElapsedMs) ?? parseElapsed(snapshot.timeElapsed) ?? 0;
  const status =
    typeof snapshot.status === 'string' && snapshot.status.trim().length > 0
      ? snapshot.status.trim()
      : DEFAULT_STATUS;

  statsState = {
    steps,
    status,
    elapsedMs,
    running: false
  };
  simulationStartTime = null;
  renderStats();
}

