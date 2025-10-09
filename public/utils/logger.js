import { DOM } from './constants.js';

/**
 * Action log utilities
 *
 * Handles rendering of user/system/agent activity entries within the
 * dashboard "Action Tower" panel.
 */

const ENTRY_BASE_CLASS = 'flex items-start gap-3 border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-brand-dark shadow-sm';
const LABEL_CLASSES = {
  agent: 'log-badge font-semibold uppercase tracking-[0.18em] text-brand-primary',
  user: 'log-badge font-semibold uppercase tracking-[0.18em] text-brand-dark/70',
  system: 'log-badge font-semibold uppercase tracking-[0.18em] text-slate-500'
};

let logContainer = null;
let initialized = false;

/**
 * Bind the logger to a DOM container
 */
export function initializeLogger({ selector } = {}) {
  logContainer = selector ? document.querySelector(selector) : DOM.actionLog();
  initialized = Boolean(logContainer);
  if (initialized && !logContainer.classList.contains('space-y-2')) {
    logContainer.classList.add('space-y-2');
  }
}

/**
 * Append a formatted entry to the action log
 * @param {string} action - Message to display
 * @param {'agent'|'user'|'system'} [type='agent'] - Entry category
 */
export function logAction(action, type = 'agent') {
  if (!initialized || !action) return;

  const entry = document.createElement('div');
  entry.className = ENTRY_BASE_CLASS;

  const label = document.createElement('span');
  const resolvedType = LABEL_CLASSES[type] ? type : 'system';
  label.className = LABEL_CLASSES[resolvedType];
  label.textContent = resolvedType === 'agent'
    ? 'BDI Agent'
    : resolvedType === 'user'
      ? (window.localStorage?.getItem('username') || 'User')
      : 'System';

  const message = document.createElement('span');
  message.className = 'log-message flex-1 text-[13px] text-brand-dark';
  message.textContent = action;

  const time = document.createElement('time');
  time.className = 'log-time ml-auto text-[10px] font-mono uppercase tracking-[0.2em] text-brand-dark/50';
  const now = new Date();
  time.dateTime = now.toISOString();
  time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  entry.appendChild(label);
  entry.appendChild(message);
  entry.appendChild(time);

  logContainer.appendChild(entry);

  // Keep the log trim so the panel never overflows aggressively
  const MAX_ENTRIES = 120;
  while (logContainer.children.length > MAX_ENTRIES) {
    logContainer.removeChild(logContainer.firstElementChild);
  }

  logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Convenience helper for agent move entries (legacy compatibility)
 */
export function logMove(description) {
  logAction(description, 'agent');
}
