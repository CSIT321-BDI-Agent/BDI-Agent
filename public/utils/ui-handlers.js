/**
 * Simulation UI controller
 *
 * Centralises dashboard interactions: block management, planner requests,
 * persistence shortcuts, and control state synchronisation.
 */

import { DOM, resetClawToDefault } from './constants.js';
import { showMessage, handleError } from './helpers.js';
import {
  resetIntentionTimeline,
  renderIntentionTimeline,
  startPlannerClock,
  stopPlannerClock,
  finalizeTimeline,
  markTimelineStep
} from './timeline.js';
import { requestBDIPlan } from './planner.js';
import { simulateMove } from './animation.js';
import { saveWorld, loadSelectedWorld, refreshLoadList } from './persistence.js';
import { startStatsTimer, stopStatsTimer, updateStats, resetStats } from './stats.js';
import { logAction } from './logger.js';

const LETTER_Z_CODE = 'Z'.charCodeAt(0);
const MOVE_CYCLE_BUFFER = 600; // buffer to let the claw settle between moves

class SimulationController {
  constructor(world) {
    this.world = world;
    this.maxBlocks = window.APP_CONFIG?.MAX_BLOCKS || 26;
    this.animationDuration = window.APP_CONFIG?.ANIMATION_DURATION || 550;
    this.controlsDisabled = false;
    this.elements = {};
  }

  initialize() {
    this.cacheDom();
    this.bindEvents();
    this.syncBlockControls();
    resetStats();
    refreshLoadList();
  }

  cacheDom() {
    this.elements = {
      world: DOM.world(),
      addBtn: DOM.addBlockBtn(),
      removeBtn: DOM.removeBlockBtn(),
      blockCountLabel: DOM.blockCountLabel(),
      nextBlockLabel: DOM.nextBlockLabel(),
      startBtn: DOM.startBtn(),
      goalInput: DOM.goalInput(),
      saveBtn: DOM.saveBtn(),
      loadBtn: DOM.loadBtn(),
      loadSelect: DOM.loadSelect()
    };
  }

  bindEvents() {
    this.elements.addBtn?.addEventListener('click', () => this.handleBlockAddition());
    this.elements.removeBtn?.addEventListener('click', () => this.handleBlockRemoval());
    this.elements.startBtn?.addEventListener('click', () => this.runSimulation());

    this.elements.goalInput?.addEventListener('keypress', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        this.runSimulation();
      }
    });

    this.elements.saveBtn?.addEventListener('click', () => saveWorld(this.world));
    this.elements.loadBtn?.addEventListener('click', () => loadSelectedWorld(this.world));

    document.addEventListener('world:blocks-changed', () => this.syncBlockControls());
  }

  get blockCount() {
    return this.world ? this.world.getCurrentBlocks().length : 0;
  }

  getNextBlockLetter() {
    if (!this.world) return null;
    const blocks = this.world.getCurrentBlocks();
    if (blocks.length >= this.maxBlocks) return null;

    if (blocks.length === 0) return 'A';
    const sorted = [...blocks].sort();
    const lastBlock = sorted[sorted.length - 1];
    const nextCode = lastBlock.charCodeAt(0) + 1;
    if (nextCode > LETTER_Z_CODE) return null;
    return String.fromCharCode(nextCode);
  }

  getTopmostBlock() {
    if (!this.world) return null;
    const stacks = this.world.getCurrentStacks();
    for (let i = stacks.length - 1; i >= 0; i -= 1) {
      const stack = stacks[i];
      if (Array.isArray(stack) && stack.length > 0) {
        return stack[stack.length - 1];
      }
    }
    return null;
  }

  syncBlockControls(forceDisabled = this.controlsDisabled) {
    const { blockCountLabel, nextBlockLabel } = this.elements;

    if (blockCountLabel) {
      blockCountLabel.textContent = String(this.blockCount).padStart(2, '0');
    }

    if (nextBlockLabel) {
      const nextLetter = this.getNextBlockLetter();
      nextBlockLabel.textContent = nextLetter || '--';
    }

    this.refreshStepperAvailability(forceDisabled);
  }

  refreshStepperAvailability(forceDisabled = this.controlsDisabled) {
    const { addBtn, removeBtn } = this.elements;
    if (!addBtn || !removeBtn) return;

    if (forceDisabled) {
      addBtn.disabled = true;
      removeBtn.disabled = true;
      return;
    }

    addBtn.disabled = !this.getNextBlockLetter();
    removeBtn.disabled = this.blockCount === 0;
  }

  handleBlockAddition() {
    if (this.controlsDisabled) return;
    const nextLetter = this.getNextBlockLetter();

    if (!nextLetter) {
      showMessage(`Maximum number of blocks (${this.maxBlocks}) reached.`, 'warning');
      this.refreshStepperAvailability();
      return;
    }

    const added = this.world.addBlock(nextLetter);
    if (added) {
      logAction(`Added block "${nextLetter}" to the workspace`, 'user');
      this.syncBlockControls();
    }
  }

  handleBlockRemoval() {
    if (this.controlsDisabled) return;
    const targetBlock = this.getTopmostBlock();

    if (!targetBlock) {
      showMessage('No blocks available to remove.', 'info');
      this.refreshStepperAvailability();
      return;
    }

    const removed = this.world.removeBlock(targetBlock);
    if (removed) {
      logAction(`Removed block "${targetBlock}" from the workspace`, 'user');
      this.syncBlockControls();
    }
  }

  setControlsDisabled(disabled) {
    this.controlsDisabled = disabled;
    const { startBtn, saveBtn, loadBtn, goalInput } = this.elements;

    [startBtn, saveBtn, loadBtn, goalInput].forEach((element) => {
      if (element) element.disabled = disabled;
    });

    if (disabled) {
      showMessage('Simulation running...', 'info');
    }

    this.refreshStepperAvailability(disabled);
  }

  async runSimulation() {
    if (!this.world || this.controlsDisabled) return;

    const goalInput = (this.elements.goalInput?.value || '').trim();
    if (!goalInput) {
      showMessage('Please enter a goal (e.g., "A on B on C").', 'error');
      return;
    }

    const goalTokens = goalInput
      .split(/\s*on\s*/i)
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);

    if (goalTokens.length === 0) {
      showMessage('Goal input is empty or invalid.', 'error');
      return;
    }

    const currentBlocks = this.world.getCurrentBlocks();
    const unknownBlocks = goalTokens.filter((token) => token !== 'TABLE' && !currentBlocks.includes(token));
    if (unknownBlocks.length > 0) {
      showMessage(`Unknown blocks in goal: ${unknownBlocks.join(', ')}.`, 'error');
      return;
    }

    this.setControlsDisabled(true);
    resetIntentionTimeline('Requesting plan from BDI agent...');
    startPlannerClock();

    startStatsTimer();
    updateStats(undefined, 'Planning');
    logAction(`Started planning for goal: ${goalTokens.join(' on ')}`, 'user');

    try {
      const plannerResponse = await requestBDIPlan(
        this.world.getCurrentStacks(),
        goalTokens,
        { maxIterations: window.APP_CONFIG?.PLANNER?.MAX_ITERATIONS || 2500 }
      );

      if (!plannerResponse.goalAchieved) {
        this.handlePlannerFailure(plannerResponse);
        return;
      }

      this.handlePlannerSuccess(plannerResponse);
    } catch (error) {
      handleError(error, 'planning');
      stopPlannerClock(false);
      resetIntentionTimeline('Planner request failed.');
      stopStatsTimer(false);
      updateStats(undefined, 'Unexpected Error');
      this.setControlsDisabled(false);
    }
  }

  handlePlannerFailure(plannerResponse) {
    showMessage('Planner could not achieve the goal within the iteration limit.', 'warning');
    renderIntentionTimeline(
      plannerResponse.intentionLog || [],
      plannerResponse.agentCount || 1,
      { emptyMessage: 'Planner did not complete successfully.' }
    );

    stopPlannerClock(true);
    stopStatsTimer(true);
    const actualCycles = (plannerResponse.intentionLog || []).length;
    updateStats(actualCycles, 'Failure');
    this.setControlsDisabled(false);
  }

  async handlePlannerSuccess(plannerResponse) {
    const moves = plannerResponse.moves || [];
    renderIntentionTimeline(
      plannerResponse.intentionLog || [],
      plannerResponse.agentCount || 1
    );

    if (moves.length === 0) {
      showMessage('Goal already satisfied - no moves required.', 'info');
      finalizeTimeline();
      stopPlannerClock(true);
      stopStatsTimer(true);
      updateStats(0, 'Success');
      this.setControlsDisabled(false);
      return;
    }

    updateStats(undefined, 'Running');
    await this.executeMoves(moves);

    finalizeTimeline();
    stopPlannerClock(true);

    const actualCycles = (plannerResponse.intentionLog || []).length;
    const moveCount = moves.length;
    stopStatsTimer(true);
    updateStats(actualCycles, 'Success');
    showMessage(`Goal achieved with ${moveCount} ${moveCount === 1 ? 'move' : 'moves'} (${actualCycles} cycles).`, 'success');
    logAction(`Goal achieved with ${moveCount} ${moveCount === 1 ? 'move' : 'moves'} (${actualCycles} cycles)`, 'system');

    this.setControlsDisabled(false);
  }

  async executeMoves(moves) {
    const claw = document.getElementById('claw');

    if (claw && moves.length > 0) {
      resetClawToDefault(claw);
      await this.wait(this.animationDuration + MOVE_CYCLE_BUFFER);
    }

    for (const move of moves) {
      await new Promise((resolve) => {
        simulateMove(
          move,
          this.world,
          this.elements.world,
          claw,
          markTimelineStep,
          resolve
        );
      });
    }

    if (claw && moves.length > 0) {
      await this.wait(200);
      resetClawToDefault(claw);
      await this.wait(this.animationDuration + MOVE_CYCLE_BUFFER);
    }
  }

  wait(duration) {
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }
}

let controllerInstance = null;

export function initializeHandlers(world) {
  controllerInstance = new SimulationController(world);
  controllerInstance.initialize();
  return controllerInstance;
}

export function setControlsDisabled(disabled) {
  controllerInstance?.setControlsDisabled(disabled);
}

export function runSimulation() {
  return controllerInstance?.runSimulation();
}

export function getSimulationController() {
  return controllerInstance;
}
