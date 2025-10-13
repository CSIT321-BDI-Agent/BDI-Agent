import {
  requireAuth,
  authenticatedFetch,
  logout as authLogout,
  updateUIWithUserInfo
} from './auth.js';
import { initializeMobileNavigation, initializeSidebarNavigation } from './navigation.js';
import { initializeProfileMenu } from './profile.js';
import { showMessage, handleError } from './helpers.js';
import { API_BASE } from './constants.js';

const worldLogsBody = document.getElementById('worldLogs');
const worldCountElem = document.getElementById('worldCount');
const actionCountElem = document.getElementById('actionCount');
const emptyStateElem = document.getElementById('emptyState');

const formatDurationMs = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '--';
  const seconds = Math.floor(ms / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${String(centiseconds).padStart(2, '0')}s`;
};

const resolveStatsDisplay = (stats) => {
  if (!stats || typeof stats !== 'object') {
    return { steps: '--', time: '--', status: '--' };
  }

  const steps = Number.isFinite(stats.steps) ? Math.max(0, Math.floor(stats.steps)) : '--';
  const time = typeof stats.timeElapsed === 'string' && stats.timeElapsed.trim().length > 0
    ? stats.timeElapsed.trim()
    : Number.isFinite(stats.timeElapsedMs)
      ? formatDurationMs(stats.timeElapsedMs)
      : '--';
  const status = typeof stats.status === 'string' && stats.status.trim().length > 0
    ? stats.status.trim()
    : '--';

  return { steps, time, status };
};

const normalizeWorldIdentifier = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if (typeof raw.$oid === 'string') return raw.$oid;
    if (typeof raw.toString === 'function') {
      const candidate = raw.toString();
      if (candidate && candidate !== '[object Object]') {
        return candidate;
      }
    }
  }
  return null;
};

async function fetchWorldLogs() {
  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds`, { method: 'GET' });
    if (!response.ok) {
      throw new Error('Failed to load world logs.');
    }
    const worlds = await response.json();
    renderWorldLogs(worlds);
  } catch (error) {
    handleError(error, 'loading saved worlds');
  }
}

function renderWorldLogs(worlds = []) {
  const hasWorlds = Array.isArray(worlds) && worlds.length > 0;
  worldLogsBody.innerHTML = '';

  if (!hasWorlds) {
    worldCountElem.textContent = '0';
    actionCountElem.textContent = '0';
    emptyStateElem.classList.remove('hidden');
    return;
  }

  emptyStateElem.classList.add('hidden');
  worldCountElem.textContent = String(worlds.length);

  let aggregateActions = 0;

  worlds.forEach((world) => {
    const {
      _id,
      name,
      blocks = [],
      stacks = [],
      stats = null,
      timeline = null,
      updatedAt,
      createdAt
    } = world || {};

    const worldId = normalizeWorldIdentifier(_id);
    if (!worldId) {
      return;
    }

    const displayName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'Untitled World';
    const blockCount = Array.isArray(blocks) ? blocks.length : 0;
    const stackCount = Array.isArray(stacks) ? stacks.length : 0;
    const savedAt = updatedAt || createdAt || null;
    const savedAtText = savedAt
      ? new Date(savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '--';

    const timelineLog = Array.isArray(timeline?.log) ? timeline.log : [];
    const cycleCount = timelineLog.length;
    const actionCount = timelineLog.reduce((total, cycle) => {
      if (!cycle || !Array.isArray(cycle.moves)) return total;
      return total + cycle.moves.filter(move => move && move.block).length;
    }, 0);
    aggregateActions += actionCount;

    const { steps: statSteps, time: statTime, status: statStatus } = resolveStatsDisplay(stats);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-3">
        <div class="flex flex-col">
          <span class="font-semibold text-brand-dark">${displayName}</span>
          <span class="text-xs text-brand-dark/60">${stackCount} stack${stackCount === 1 ? '' : 's'}</span>
        </div>
      </td>
      <td class="px-4 py-3">${blockCount}</td>
      <td class="px-4 py-3 text-sm text-brand-dark/80">${savedAtText}</td>
      <td class="px-4 py-3">${statSteps}</td>
      <td class="px-4 py-3">${statTime}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center rounded bg-brand-primary/10 px-2 py-1 text-xs font-semibold text-brand-primary">${statStatus}</span>
      </td>
      <td class="px-4 py-3">${cycleCount}</td>
      <td class="px-4 py-3">${actionCount}</td>
      <td class="px-4 py-3 text-right">
        <button
          data-id="${worldId}"
          data-name="${displayName.replace(/"/g, '&quot;')}"
          class="delete-log inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <span class="material-icons text-xs">delete</span>
          Delete
        </button>
      </td>
    `;

    worldLogsBody.appendChild(row);
  });

  actionCountElem.textContent = String(aggregateActions);
  attachDeleteHandlers();
}

function attachDeleteHandlers() {
  const deleteButtons = worldLogsBody.querySelectorAll('.delete-log');
  deleteButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const worldId = event.currentTarget.getAttribute('data-id');
      const worldName = event.currentTarget.getAttribute('data-name') || 'this world';
      if (!worldId) return;
      const confirmed = window.confirm(`Delete "${worldName}" and its logs? This action cannot be undone.`);
      if (!confirmed) {
        return;
      }
      await deleteWorld(worldId, worldName);
    });
  });
}

async function deleteWorld(worldId, worldName) {
  const encodedId = encodeURIComponent(worldId);
  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds/${encodedId}`, {
      method: 'DELETE'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Failed to delete world.');
    }
    const successMessage = payload.message || `World "${worldName}" deleted successfully.`;
    showMessage(successMessage, 'success');
    if (typeof window.refreshLoadList === 'function') {
      window.refreshLoadList();
    }
    await fetchWorldLogs();
  } catch (error) {
    console.error('Delete world error', error);
    handleError(error, 'deleting saved world');
  }
}

function initializePage() {
  if (!worldLogsBody || !worldCountElem || !actionCountElem || !emptyStateElem) {
    console.error('Required DOM nodes for agent logs could not be found.');
    return;
  }
  requireAuth();

  initializeMobileNavigation();
  initializeSidebarNavigation({ activeRoute: 'agent-logs', storageKey: 'bdiSidebarCollapsed' });
  initializeProfileMenu();

  updateUIWithUserInfo({
    adminNav: '.admin-nav-link'
  });

  window.logout = authLogout;

  fetchWorldLogs();
}

initializePage();

// Optional manual refresh hook for other modules or future buttons
window.agentLogs = {
  refresh: fetchWorldLogs
};
