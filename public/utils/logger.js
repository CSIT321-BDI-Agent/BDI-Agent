/**
 * Action log utilities
 *
 * Handles rendering of user/system/agent activity entries within the
 * dashboard "Action Tower" panel.
 */

let logContainer = null;
let initialized = false;

/**
 * Bind the logger to a DOM container
 */
export function initializeLogger({ selector = '#actionLog' } = {}) {
  logContainer = document.querySelector(selector);
  initialized = Boolean(logContainer);
}

/**
 * Append a formatted entry to the action log
 * @param {string} action - Message to display
 * @param {'agent'|'user'|'system'} [type='agent'] - Entry category
 */
export function logAction(action, type = 'agent') {
  if (!initialized || !action) return;

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const username = window.localStorage?.getItem('username') || 'User';

  if (type === 'agent') {
    entry.innerHTML = `<span class="log-agent">[BDI-Agent]</span> <span class="log-action">${action}</span>`;
  } else if (type === 'user') {
    entry.innerHTML = `<span class="log-user">[${username}]</span> <span class="log-action">${action}</span>`;
  } else {
    entry.innerHTML = `<span class="log-action">${action}</span>`;
  }

  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Convenience helper for agent move entries (legacy compatibility)
 */
export function logMove(description) {
  logAction(description, 'agent');
}
