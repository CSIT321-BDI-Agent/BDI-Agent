/**
 * World Persistence System
 * 
 * Handles saving and loading block world configurations to/from the backend
 */

import { DOM } from './constants.js';
import { showMessage, handleError } from './helpers.js';
import { getCurrentUser, authenticatedFetch } from './auth.js';
import { logAction } from './logger.js';
import { getIntentionTimelineSnapshot, restoreTimelineFromSnapshot } from './timeline.js';
import { updateWorldInfoFromStacks } from './dashboard-ui.js';
import { getStatsSnapshot, applyStatsSnapshot } from './stats.js';

const META_STORAGE_KEY = 'bdiWorldMeta';

const loadMetaCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage?.getItem(META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to load world metadata cache:', error);
    return {};
  }
};

const worldMetaCache = loadMetaCache();

const persistMetaCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage?.setItem(META_STORAGE_KEY, JSON.stringify(worldMetaCache));
  } catch (error) {
    console.warn('Failed to persist world metadata cache:', error);
  }
};

const buildMetaKey = (userId, worldName) => {
  if (!userId || !worldName) return null;
  return `${userId}::${worldName}`;
};

const normalizeStatsSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const normalized = {};

  if (Number.isFinite(snapshot.steps)) {
    normalized.steps = Number(snapshot.steps);
  } else if (typeof snapshot.steps === 'string') {
    const parsed = Number(snapshot.steps);
    if (Number.isFinite(parsed)) {
      normalized.steps = parsed;
    }
  }

  const normalizeDisplay = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    if (str.length === 0 || str === '--') return null;
    return str;
  };

  const stepsDisplay = normalizeDisplay(snapshot.stepsDisplay);
  if (stepsDisplay) {
    normalized.stepsDisplay = stepsDisplay;
  } else if (normalized.steps != null) {
    normalized.stepsDisplay = String(normalized.steps);
  }

  const timeDisplay = normalizeDisplay(snapshot.time);
  if (timeDisplay) {
    normalized.time = timeDisplay;
  }

  const statusDisplay = normalizeDisplay(snapshot.status);
  if (statusDisplay) {
    normalized.status = statusDisplay;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const deriveStatsFromTimeline = (timelineSnapshot) => {
  if (!timelineSnapshot || typeof timelineSnapshot !== 'object') {
    return null;
  }

  const log = Array.isArray(timelineSnapshot.log) ? timelineSnapshot.log : [];
  if (log.length === 0) {
    return null;
  }

  let steps = 0;
  log.forEach(cycle => {
    if (Array.isArray(cycle?.moves)) {
      cycle.moves.forEach(move => {
        if (!move) return;
        if (
          typeof move.stepNumber === 'number' ||
          move.block ||
          move.skipped ||
          move.stepDescription
        ) {
          steps += 1;
        }
      });
    } else {
      steps += 1;
    }
  });

  if (steps === 0) {
    steps = log.length;
  }

  const timeDisplay =
    typeof timelineSnapshot.clockDisplay === 'string' && timelineSnapshot.clockDisplay.trim().length > 0
      ? timelineSnapshot.clockDisplay.trim()
      : Array.isArray(timelineSnapshot.durations) && timelineSnapshot.durations.length > 0
        ? String(timelineSnapshot.durations[timelineSnapshot.durations.length - 1]).trim()
        : null;

  return {
    steps,
    stepsDisplay: String(steps),
    time: timeDisplay || '--:--',
    status: 'Snapshot loaded'
  };
};

const mergeStatsSnapshots = (...snapshots) => {
  const result = {};
  snapshots.forEach(snapshot => {
    const normalized = normalizeStatsSnapshot(snapshot);
    if (!normalized) return;

    if (result.steps == null && Number.isFinite(normalized.steps)) {
      result.steps = normalized.steps;
    }
    if (result.stepsDisplay == null && typeof normalized.stepsDisplay === 'string') {
      result.stepsDisplay = normalized.stepsDisplay;
    }
    if (result.time == null && typeof normalized.time === 'string') {
      result.time = normalized.time;
    }
    if (result.status == null && typeof normalized.status === 'string') {
      result.status = normalized.status;
    }
  });

  return Object.keys(result).length > 0 ? result : null;
};

const getWorldStateSnapshot = (world) => ({
  stacks: world.getCurrentStacks(),
  colours: world.getCurrentColours(),
  timeline: getIntentionTimelineSnapshot(),
  stats: normalizeStatsSnapshot(getStatsSnapshot())
});
const LOAD_SELECT_MESSAGES = {
  default: 'Select a saved world',
  empty: 'No saved worlds yet',
  login: 'Log in to see saved worlds',
  error: 'Error loading worlds',
  failed: 'Failed to fetch worlds'
};

const normalizeWorldIdentifier = (doc) => {
  const raw = doc?._id ?? doc?.id ?? null;
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

const loadSelectManager = {
  get() {
    return DOM.loadSelect() || null;
  },

  ensureDefault(selector, message = LOAD_SELECT_MESSAGES.default) {
    if (!selector) return;
    if (selector.options.length > 0 && selector.options[0].value === '') {
      selector.options[0].textContent = message;
      return;
    }
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    selector.insertBefore(option, selector.firstChild);
  },

  setStatus(messageKey) {
    const selector = this.get();
    if (!selector) return;
    const message = LOAD_SELECT_MESSAGES[messageKey] || messageKey || LOAD_SELECT_MESSAGES.default;

    selector.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    selector.appendChild(option);
  },

  upsert(worldDoc) {
    const selector = this.get();
    if (!selector || !worldDoc) return;

    const id = normalizeWorldIdentifier(worldDoc);
    const name = typeof worldDoc?.name === 'string' ? worldDoc.name.trim() : '';
    if (!id || !name) return;

    this.ensureDefault(selector);

    const existing = Array.from(selector.options).find(option => option.value === id);
    if (existing) {
      existing.textContent = name;
      return;
    }

    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;

    if (selector.options.length > 1) {
      selector.insertBefore(option, selector.options[1]);
    } else {
      selector.appendChild(option);
    }
  },

  rebuild(worlds) {
    const selector = this.get();
    if (!selector) return;

    if (!Array.isArray(worlds) || worlds.length === 0) {
      this.setStatus('empty');
      return;
    }

    selector.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = LOAD_SELECT_MESSAGES.default;
    fragment.appendChild(defaultOption);

    worlds.forEach((world) => {
      const id = normalizeWorldIdentifier(world);
      const name = typeof world?.name === 'string' ? world.name.trim() : '';
      if (!id || !name) return;
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      fragment.appendChild(option);
    });

    selector.appendChild(fragment);
  }
};

/**
 * Save current world to backend
 * @param {Object} world - World instance
 * @returns {Promise<void>}}
 */
export async function saveWorld(world) {
  const worldName = prompt('World name?');
  if (!worldName || worldName.trim().length === 0) {
    showMessage('Please enter a valid world name.', 'error');
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    showMessage('You must be logged in to save worlds.', 'error');
    return;
  }

  const trimmedName = worldName.trim();
  const currentSnapshot = getWorldStateSnapshot(world);
  const resolvedStats = mergeStatsSnapshots(
    currentSnapshot.stats,
    deriveStatsFromTimeline(currentSnapshot.timeline)
  );
  currentSnapshot.stats = resolvedStats;
  const metaKey = buildMetaKey(user.userId, trimmedName);

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds`, {
      method: 'POST',
      body: JSON.stringify({
        name: trimmedName,
        blocks: world.getCurrentBlocks(),
        stacks: currentSnapshot.stacks,
        colours: currentSnapshot.colours,
        timeline: currentSnapshot.timeline,
        stats: resolvedStats
      })
    });

    let responseData = null;
    try {
      responseData = await response.json();
    } catch (error) {
      responseData = null;
    }

    if (!response.ok) {
      const message = responseData?.message || response.statusText;
      throw new Error(message || `Failed to save world: ${response.statusText}`);
    }

    if (responseData) {
      loadSelectManager.upsert(responseData);
    }

    const savedColours = responseData && responseData.colours && typeof responseData.colours === 'object'
      ? responseData.colours
      : currentSnapshot.colours;

    const savedTimeline = responseData && Object.prototype.hasOwnProperty.call(responseData, 'timeline')
      ? responseData.timeline
      : currentSnapshot.timeline;

    const savedStats = mergeStatsSnapshots(
      responseData && typeof responseData.stats === 'object' ? responseData.stats : null,
      currentSnapshot.stats
    );

    showMessage(`World "${trimmedName}" saved successfully!`, 'success');
    
    // Log save action
    logAction(`Saved world "${trimmedName}" (${world.getCurrentBlocks().length} blocks)`, 'user');

    if (metaKey) {
      worldMetaCache[metaKey] = {
        colours: savedColours,
        timeline: savedTimeline,
        stats: savedStats,
        updatedAt: Date.now()
      };
      persistMetaCache();
    }
    
    await refreshLoadList();
  } catch (error) {
    handleError(error, 'saving world');
  }
}

/**
 * Load a selected world from backend
 * @param {Object} world - World instance to populate
 * @returns {Promise<void>}
 */
export async function loadSelectedWorld(world) {
  const selector = DOM.loadSelect();
  const selected = selector.value;
  if (!selected) {
    showMessage('Please select a world to load.', 'error');
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    showMessage('You must be logged in to load worlds.', 'error');
    return;
  }

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds/${selected}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to load world: ${response.statusText}`);
    }

    const data = await response.json();
    const metaKey = buildMetaKey(user.userId, data?.name);
    const savedMeta = metaKey ? worldMetaCache[metaKey] : null;
    const targetColours = data.colours || data.colors || savedMeta?.colours || {};
    const targetStacks = Array.isArray(data.stacks) ? data.stacks : [];
    const targetTimeline = data.timeline || savedMeta?.timeline || null;
    const targetStats = mergeStatsSnapshots(
      data.stats,
      savedMeta?.stats,
      deriveStatsFromTimeline(targetTimeline)
    );

    rebuildWorldFrom(world, targetStacks, data.on, targetColours);
    restoreTimelineFromSnapshot(targetTimeline);
    updateWorldInfoFromStacks(targetStacks);
    applyStatsSnapshot(targetStats);
    const refreshedSnapshot = getWorldStateSnapshot(world);
    if (metaKey) {
      worldMetaCache[metaKey] = {
        colours: refreshedSnapshot.colours,
        timeline: refreshedSnapshot.timeline,
        stats: refreshedSnapshot.stats,
        updatedAt: Date.now()
      };
      persistMetaCache();
    }

    showMessage(`World "${data.name}" loaded successfully!`, 'success');
    
    // Log load action
    const blockCount = world.getCurrentBlocks().length;
    logAction(`Loaded world "${data.name}" (${blockCount} blocks)`, 'user');
  } catch (error) {
    handleError(error, 'loading world');
  }
}

/**
 * Refresh the list of saved worlds
 * @returns {Promise<void>}
 */
export async function refreshLoadList() {
  const user = getCurrentUser();

  if (!user) {
    loadSelectManager.setStatus('login');
    return;
  }

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds`, {
      method: 'GET'
    });

    if (!response.ok) {
      loadSelectManager.setStatus('failed');
      return;
    }

    const worlds = await response.json();
    loadSelectManager.rebuild(worlds);
  } catch (error) {
    handleError(error, 'refreshing world list');
    loadSelectManager.setStatus('error');
  }
}

/**
 * Rebuild world from saved data
 * @param {Object} world - World instance
 * @param {Array<Array<string>>} stacks - Saved stacks
 * @param {Object} on - Saved on relationships (optional, will be reconstructed)
 */
export function rebuildWorldFrom(world, stacks, on, colours) {
  try {
    // Validate input
    if (!Array.isArray(stacks)) {
      throw new Error('Invalid stacks data: expected array');
    }

    stacks.forEach((stack, idx) => {
      if (!Array.isArray(stack)) {
        throw new Error(`Invalid stack at index ${idx}: expected array`);
      }
      stack.forEach((block, blockIdx) => {
        if (typeof block !== 'string' || block.length !== 1 || !/^[A-Z]$/.test(block)) {
          throw new Error(`Invalid block "${block}" in stack ${idx}, position ${blockIdx}`);
        }
      });
    });

    // Store backup for rollback
    const backup = {
      stacks: world.stacks.map(s => [...s]),
      on: { ...world.on },
      blocks: [...world.blocks],
      colours: { ...world.colours }
    };

    // Clear DOM elements
    const blockElements = Array.from(DOM.world().querySelectorAll('.world-block'));
    blockElements.forEach(elem => elem.remove());

    // Reset world state
    world.stacks = [];
    world.on = {};
    world.blocks = [];
    const providedColours = colours && typeof colours === 'object' ? { ...colours } : {};
    world.colours = providedColours;

    // Get all unique blocks from stacks
    const allBlocks = [...new Set(stacks.flat())];
    
    // Add blocks to world (creates DOM elements and assigns colors)
    allBlocks.forEach(name => world.addBlock(name));

    // Set stack configuration
    world.stacks = stacks.map(s => [...s]);

    // Rebuild 'on' relationships from stacks
    world.on = {};
    world.stacks.forEach(stack => {
      if (stack.length > 0) {
        world.on[stack[0]] = 'Table';
        for (let i = 1; i < stack.length; i++) {
          world.on[stack[i]] = stack[i - 1];
        }
      }
    });

    // Update visual positions
    world.updatePositions();
    world.applyColoursToDOM();

    if (typeof world.notifyBlocksChanged === 'function') {
      world.notifyBlocksChanged();
    }
    
  } catch (error) {
    // Rollback on error
    handleError(error, 'rebuilding world');
    throw error;
  }
}
