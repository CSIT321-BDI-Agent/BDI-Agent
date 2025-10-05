/**
 * UI Event Handlers
 * 
 * Manages all user interface interactions and orchestrates planner execution
 */

import { DOM } from './constants.js';
import { showMessage, handleError } from './helpers.js';
import { resetIntentionTimeline, renderIntentionTimeline, startPlannerClock, stopPlannerClock, finalizeTimeline } from './timeline.js';
import { requestBDIPlan } from './planner.js';
import { simulateMove } from './animation.js';
import { saveWorld, loadSelectedWorld, refreshLoadList } from './persistence.js';

/**
 * Enable/disable control buttons and inputs
 * @param {boolean} disabled - Whether controls should be disabled
 */
export function setControlsDisabled(disabled) {
  DOM.addBlockBtn().disabled = disabled;
  DOM.startBtn().disabled = disabled;
  DOM.saveBtn().disabled = disabled;
  DOM.loadBtn().disabled = disabled;
  DOM.newBlockInput().disabled = disabled;
  DOM.goalInput().disabled = disabled;
}

/**
 * Add block button handler
 * @param {Object} world - World instance
 */
export function handleAddBlock(world) {
  const input = DOM.newBlockInput();
  const name = input.value.trim().toUpperCase();
  
  if (!name) {
    showMessage('Please enter a block name (single letter).', 'error');
    return;
  }

  if (!/^[A-Z]$/.test(name)) {
    showMessage('Block names must be a single letter (A-Z).', 'error');
    return;
  }

  const MAX_BLOCKS = window.APP_CONFIG?.MAX_BLOCKS || 26;
  if (world.getCurrentBlocks().length >= MAX_BLOCKS) {
    showMessage(`Maximum number of blocks (${MAX_BLOCKS}) reached.`, 'error');
    return;
  }

  if (world.getCurrentBlocks().includes(name)) {
    showMessage(`Block "${name}" already exists.`, 'error');
    return;
  }

  world.addBlock(name, 'Table');
  input.value = '';
  input.focus();
}

/**
 * Run the planner simulation
 * @param {Object} world - World instance
 */
export async function runSimulation(world) {
  const goalInput = DOM.goalInput().value.trim();
  if (!goalInput) {
    showMessage('Please enter a goal (e.g., "A on B on C").', 'error');
    return;
  }

  // Parse goal chain
  const goalTokens = goalInput
    .split(/\s*on\s*/i)
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  if (goalTokens.length === 0) {
    showMessage('Goal input is empty or invalid.', 'error');
    return;
  }

  const currentBlocks = world.getCurrentBlocks();
  const unknownBlocks = goalTokens.filter(t => t !== 'TABLE' && !currentBlocks.includes(t));
  
  if (unknownBlocks.length > 0) {
    showMessage(`Unknown blocks in goal: ${unknownBlocks.join(', ')}`, 'error');
    return;
  }

  setControlsDisabled(true);
  resetIntentionTimeline('Requesting plan from BDI agent...');
  startPlannerClock();

  try {
    const plannerResponse = await requestBDIPlan(
      world.getCurrentStacks(),
      goalTokens,
      { maxIterations: window.APP_CONFIG?.PLANNER?.MAX_ITERATIONS || 2500 }
    );

    if (!plannerResponse.goalAchieved) {
      showMessage('Planner could not achieve the goal within the iteration limit.', 'warning');
      renderIntentionTimeline(
        plannerResponse.intentionLog || [],
        plannerResponse.agentCount || 1,
        { emptyMessage: 'Planner did not complete successfully.' }
      );
      stopPlannerClock(true);
      setControlsDisabled(false);
      return;
    }

    const moves = plannerResponse.moves || [];
    renderIntentionTimeline(
      plannerResponse.intentionLog || [],
      plannerResponse.agentCount || 1
    );

    if (moves.length === 0) {
      showMessage('Goal is already satisfied!', 'info');
      finalizeTimeline();
      stopPlannerClock(true);
      setControlsDisabled(false);
      return;
    }

    // Execute moves sequentially
    await executeMoves(world, moves);
    
    finalizeTimeline();
    stopPlannerClock(true);
    showMessage(`Goal achieved in ${plannerResponse.iterations || 0} iterations!`, 'success');
    setControlsDisabled(false);

  } catch (error) {
    handleError(error, 'planning');
    stopPlannerClock(false);
    resetIntentionTimeline('Planner request failed.');
    setControlsDisabled(false);
  }
}

/**
 * Execute a sequence of moves with animation
 * @param {Object} world - World instance
 * @param {Array} moves - Array of moves to execute
 * @returns {Promise<void>}
 */
async function executeMoves(world, moves) {
  for (const move of moves) {
    await new Promise(resolve => {
      simulateMove(world, move, resolve);
    });
  }
}

/**
 * Initialize all UI event handlers
 * @param {Object} world - World instance
 */
export function initializeHandlers(world) {
  // Add block button
  DOM.addBlockBtn().addEventListener('click', () => handleAddBlock(world));
  
  // New block input - Enter key
  DOM.newBlockInput().addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddBlock(world);
    }
  });

  // Start planner button
  DOM.startBtn().addEventListener('click', () => runSimulation(world));
  
  // Goal input - Enter key
  DOM.goalInput().addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSimulation(world);
    }
  });

  // Save world button
  DOM.saveBtn().addEventListener('click', () => saveWorld(world));

  // Load world button
  DOM.loadBtn().addEventListener('click', () => loadSelectedWorld(world));

  // Refresh world list on page load
  refreshLoadList();
}
