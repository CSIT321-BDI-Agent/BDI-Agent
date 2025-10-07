/**
 * World Persistence System
 * 
 * Handles saving and loading block world configurations to/from the backend
 */

import { DOM } from './constants.js';
import { showMessage, handleError } from './helpers.js';
import { getCurrentUser, authenticatedFetch } from './auth.js';
import { logAction } from './logger.js';

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

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds`, {
      method: 'POST',
      body: JSON.stringify({
        name: worldName.trim(),
        blocks: world.getCurrentBlocks(),
        stacks: world.getCurrentStacks()
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to save world: ${response.statusText}`);
    }

    showMessage(`World "${worldName.trim()}" saved successfully!`, 'success');
    
    // Log save action
    logAction(`Saved world "${worldName.trim()}" (${world.getCurrentBlocks().length} blocks)`, 'user');
    
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
    rebuildWorldFrom(world, data.stacks, data.on);
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
  const selector = DOM.loadSelect();
  const user = getCurrentUser();

  if (!user) {
    selector.innerHTML = '<option value="">Log in to see saved worlds</option>';
    return;
  }

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await authenticatedFetch(`${API_BASE}/worlds`, {
      method: 'GET'
    });

    if (!response.ok) {
      selector.innerHTML = '<option value="">Failed to fetch worlds</option>';
      return;
    }

    const worlds = await response.json();
    selector.innerHTML = '';

    if (!Array.isArray(worlds) || worlds.length === 0) {
      selector.innerHTML = '<option value="">No saved worlds yet</option>';
      return;
    }

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a saved world --';
    selector.appendChild(defaultOption);

    worlds.forEach(w => {
      const option = document.createElement('option');
      option.value = w._id;
      option.textContent = w.name;
      selector.appendChild(option);
    });
  } catch (error) {
    handleError(error, 'refreshing world list');
    selector.innerHTML = '<option value="">Error loading worlds</option>';
  }
}

/**
 * Rebuild world from saved data
 * @param {Object} world - World instance
 * @param {Array<Array<string>>} stacks - Saved stacks
 * @param {Object} on - Saved on relationships (optional, will be reconstructed)
 */
export function rebuildWorldFrom(world, stacks, on) {
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
    const blockElements = Array.from(DOM.world().querySelectorAll('.block'));
    blockElements.forEach(elem => elem.remove());

    // Reset world state
    world.stacks = [];
    world.on = {};
    world.blocks = [];
    world.colours = {};

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

    if (typeof world.notifyBlocksChanged === 'function') {
      world.notifyBlocksChanged();
    }
    
  } catch (error) {
    // Rollback on error
    handleError(error, 'rebuilding world');
    throw error;
  }
}
