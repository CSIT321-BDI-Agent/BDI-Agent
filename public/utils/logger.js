import { DOM } from './constants.js';

/**
 * Action log utilities
 *
 * Handles rendering of user/system/agent activity entries within the
 * dashboard "Action Log" panel.
 */

const ENTRY_BASE_CLASS = 'flex items-center px-3 py-2 font-mono text-[13px] leading-5 text-emerald-300';
const LABEL_BASE_CLASS = 'log-badge mr-6 flex-none w-40 pr-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap overflow-hidden text-ellipsis';
const LABEL_CLASSES = {
  agent: `${LABEL_BASE_CLASS} text-emerald-400`,
  user: `${LABEL_BASE_CLASS} text-sky-300`,
  system: `${LABEL_BASE_CLASS} text-slate-400`
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
    ? 'AGENT'
    : resolvedType === 'user'
      ? (window.localStorage?.getItem('username') || 'User')
      : 'System';

  const message = document.createElement('span');
  message.className = 'log-message min-w-0 flex-1 pl-2 text-left text-[13px] text-emerald-200';
  message.textContent = action;

  entry.appendChild(label);
  entry.appendChild(message);

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

