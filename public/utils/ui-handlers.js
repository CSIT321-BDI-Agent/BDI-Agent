/**
 * UI Event Handlers
 * 
 * Manages all user interface interactions and orchestrates planner execution
 */

import { DOM, resetClawToDefault } from './constants.js';
import { showMessage, handleError } from './helpers.js';
import { resetIntentionTimeline, renderIntentionTimeline, startPlannerClock, stopPlannerClock, finalizeTimeline, markTimelineStep } from './timeline.js';
import { requestBDIPlan } from './planner.js';
import { simulateMove } from './animation.js';
import { saveWorld, loadSelectedWorld, refreshLoadList } from './persistence.js';
import { startStatsTimer, stopStatsTimer, updateStats } from './stats.js';
import { logAction } from './logger.js';

const LETTER_A_CODE = 'A'.charCodeAt(0);
const LETTER_Z_CODE = 'Z'.charCodeAt(0);

let worldRef = null;
let controlsDisabled = false;

function getBlockCount() {
  return worldRef ? worldRef.getCurrentBlocks().length : 0;
}

function getNextBlockLetter() {
  if (!worldRef) return null;
  const blocks = worldRef.getCurrentBlocks();
  const maxBlocks = window.APP_CONFIG?.MAX_BLOCKS || 26;
  if (blocks.length >= maxBlocks) return null;

  if (blocks.length === 0) return 'A';
  const sorted = [...blocks].sort();
  const highest = sorted[sorted.length - 1];
  const nextCode = highest.charCodeAt(0) + 1;
  if (nextCode > LETTER_Z_CODE) return null;
  return String.fromCharCode(nextCode);
}

function getTopmostBlock() {
  if (!worldRef) return null;
  const blocks = worldRef.getCurrentBlocks();
  if (!blocks.length) return null;
  return blocks[blocks.length - 1];
}

function refreshStepperAvailability(forceDisabled = controlsDisabled) {
  const addBtn = DOM.addBlockBtn();
  const removeBtn = DOM.removeBlockBtn();
  if (!addBtn || !removeBtn) return;

  if (forceDisabled) {
    addBtn.disabled = true;
    removeBtn.disabled = true;
    return;
  }

  const nextLetter = getNextBlockLetter();
  addBtn.disabled = !nextLetter;
  removeBtn.disabled = getBlockCount() === 0;
}

function updateBlockControls() {
  if (!worldRef) return;

  const countLabel = DOM.blockCountLabel();
  const nextLabel = DOM.nextBlockLabel();

  if (countLabel) {
    countLabel.textContent = getBlockCount().toString().padStart(2, '0');
  }

  if (nextLabel) {
    const nextLetter = getNextBlockLetter();
    nextLabel.textContent = nextLetter || '--';
  }

  refreshStepperAvailability();
}

function handleBlockAddition() {
  if (!worldRef || controlsDisabled) return;
  const nextLetter = getNextBlockLetter();
  if (!nextLetter) {
    const maxBlocks = window.APP_CONFIG?.MAX_BLOCKS || 26;
    showMessage(`Maximum number of blocks (${maxBlocks}) reached.`, 'warning');
    refreshStepperAvailability();
    return;
  }

  const added = worldRef.addBlock(nextLetter);
  if (added) {
    logAction(`Added block "${nextLetter}" to workspace`, 'user');
  }

  refreshStepperAvailability();
}

function handleBlockRemoval() {
  if (!worldRef || controlsDisabled) return;
  const targetBlock = getTopmostBlock();
  if (!targetBlock) {
    showMessage('No blocks to remove.', 'info');
    refreshStepperAvailability();
    return;
  }

  const removed = worldRef.removeBlock(targetBlock);
  if (removed) {
    logAction(`Removed block "${targetBlock}" from workspace`, 'user');
  }

  refreshStepperAvailability();
}

/**
 * Enable/disable control buttons and inputs
 * @param {boolean} disabled - Whether controls should be disabled
 */
export function setControlsDisabled(disabled) {
  controlsDisabled = disabled;

  const toggle = (element) => {
    if (element) element.disabled = disabled;
  };

  toggle(DOM.startBtn());
  toggle(DOM.saveBtn());
  toggle(DOM.loadBtn());
  toggle(DOM.goalInput());

  refreshStepperAvailability(disabled);
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

  // Start stats tracking
  startStatsTimer();
  updateStats(0, 'Planning...');

  // Log simulation start
  logAction(`Started planning for goal: ${goalTokens.join(' on ')}`, 'user');

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
      
      // Update stats with failure status
      stopStatsTimer();
      const actualCycles = (plannerResponse.intentionLog || []).length;
      updateStats(actualCycles, 'Failure');

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
      
      // Update stats for already satisfied goal
      stopStatsTimer();
      updateStats(0, 'Success');

      setControlsDisabled(false);
      return;
    }

    // Update status to Running
    updateStats(0, 'Running...');
    
    // Execute moves sequentially
    await executeMoves(world, moves);
    
    finalizeTimeline();
    stopPlannerClock(true);
    
    // Calculate actual cycle count (4 cycles per move: move to source, pick up, move to dest, drop)
    const actualCycles = (plannerResponse.intentionLog || []).length;
    const moveCount = moves.length;
    showMessage(`Goal achieved with ${moveCount} ${moveCount === 1 ? 'move' : 'moves'} (${actualCycles} cycles)!`, 'success');
    
    // Update stats with success status
    stopStatsTimer();
    updateStats(actualCycles, 'Success');
    
    // Log completion
    logAction(`✓ Goal achieved with ${moveCount} ${moveCount === 1 ? 'move' : 'moves'} (${actualCycles} cycles)`, 'system');
    
    setControlsDisabled(false);

  } catch (error) {
    handleError(error, 'planning');
    stopPlannerClock(false);
    resetIntentionTimeline('Planner request failed.');
    
    // Update stats with unexpected error
    stopStatsTimer();
    updateStats(0, 'Unexpected (Error)');
    
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
  const worldElem = DOM.world();
  const claw = document.getElementById('claw');
  
  // Return claw to home position at the START of move sequence
  if (claw && moves.length > 0) {
    resetClawToDefault(claw);
    // Wait for claw to reach home position before starting moves
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  
  // Execute all moves sequentially with 4-step claw animation
  // Each claw action (move/pick/move/drop) counts as a separate cycle
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    
    // simulateMove handles 4 steps internally, marking each in timeline:
    // 1. Move claw to source (Cycle 1)
    // 2. Pick up block (Cycle 2)
    // 3. Move claw to destination (Cycle 3)
    // 4. Drop block (Cycle 4)
    await new Promise(resolve => {
      simulateMove(move, world, worldElem, claw, markTimelineStep, resolve);
    });
  }
  
  // Return claw to home position at the END of move sequence
  if (claw && moves.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 200));
    resetClawToDefault(claw);
    // Wait for claw to return to home
    await new Promise(resolve => setTimeout(resolve, 600));
  }
}

/**
 * Initialize all UI event handlers
 * @param {Object} world - World instance
 */
export function initializeHandlers(world) {
  worldRef = world;
  updateBlockControls();

  const addBtn = DOM.addBlockBtn();
  const removeBtn = DOM.removeBlockBtn();
  if (addBtn) addBtn.addEventListener('click', handleBlockAddition);
  if (removeBtn) removeBtn.addEventListener('click', handleBlockRemoval);

  const startBtn = DOM.startBtn();
  if (startBtn) startBtn.addEventListener('click', () => runSimulation(world));

  const goalInput = DOM.goalInput();
  if (goalInput) {
    goalInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSimulation(world);
      }
    });
  }

  const saveBtn = DOM.saveBtn();
  if (saveBtn) saveBtn.addEventListener('click', () => saveWorld(world));

  const loadBtn = DOM.loadBtn();
  if (loadBtn) loadBtn.addEventListener('click', () => loadSelectedWorld(world));

  document.addEventListener('world:blocks-changed', updateBlockControls);

  refreshLoadList();
}
