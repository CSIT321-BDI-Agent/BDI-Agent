/**
 * World Persistence System
 * 
 * Handles saving and loading block world configurations to/from the backend
 */

import { DOM } from './constants.js';
import { showMessage, handleError } from './helpers.js';

/**
 * Save current world to backend
 * @param {Object} world - World instance
 * @returns {Promise<void>}
 */
export async function saveWorld(world) {
  const worldName = prompt('World name?');
  if (!worldName || worldName.trim().length === 0) {
    showMessage('Please enter a valid world name.', 'error');
    return;
  }

  const userId = localStorage.getItem('userId');
  if (!userId) {
    showMessage('You must be logged in to save worlds.', 'error');
    return;
  }

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await fetch(`${API_BASE}/worlds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        name: worldName,
        stacks: world.getCurrentStacks(),
        on: world.on
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to save world: ${response.statusText}`);
    }

    showMessage(`World "${worldName.trim()}" saved successfully!`, 'success');
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

  const userId = localStorage.getItem('userId');
  if (!userId) {
    showMessage('You must be logged in to load worlds.', 'error');
    return;
  }

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await fetch(`${API_BASE}/worlds/${selected}?userId=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to load world: ${response.statusText}`);
    }

    const data = await response.json();
    rebuildWorldFrom(world, data.stacks, data.on);
    showMessage(`World "${data.name}" loaded successfully!`, 'success');
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
  const userId = localStorage.getItem('userId');

  if (!userId) {
    selector.innerHTML = '<option value="">Log in to see saved worlds</option>';
    return;
  }

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

  try {
    const response = await fetch(`${API_BASE}/worlds?userId=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
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
    console.error('Failed to refresh world list:', error);
    selector.innerHTML = '<option value="">Error loading worlds</option>';
  }
}

/**
 * Rebuild world from saved data
 * @param {Object} world - World instance
 * @param {Array<Array<string>>} stacks - Saved stacks
 * @param {Object} on - Saved on relationships
 */
export function rebuildWorldFrom(world, stacks, on) {
  const snapshot = { stacks: world.getCurrentStacks(), on: { ...world.on } };

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

    if (typeof on !== 'object' || on === null) {
      throw new Error('Invalid on data: expected object');
    }

    // Clear current world
    const blockElements = Array.from(DOM.worldArea().querySelectorAll('.block'));
    blockElements.forEach(elem => elem.remove());

    // Reset state
    world.stacks = [];
    world.on = {};

    // Rebuild stacks
    stacks.forEach((stack, stackIndex) => {
      world.stacks.push([]);
      stack.forEach((block, blockIndex) => {
        const below = blockIndex === 0 ? 'Table' : stack[blockIndex - 1];
        world.stacks[stackIndex].push(block);
        world.on[block] = below;
        world.addBlock(block, below);
      });
    });
  } catch (error) {
    // Rollback on error
    console.error('Failed to rebuild world:', error);
    world.stacks = snapshot.stacks;
    world.on = snapshot.on;
    throw error;
  }
}
