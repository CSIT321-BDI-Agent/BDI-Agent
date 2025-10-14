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
  markTimelineStep,
  getIntentionTimelineSnapshot
} from './timeline.js';
import { requestBDIPlan } from './planner.js';
import { simulateMove } from './animation.js';
import { saveWorld, loadSelectedWorld, refreshLoadList } from './persistence.js';
import { startStatsTimer, stopStatsTimer, updateStats, resetStats } from './stats.js';
import { logAction } from './logger.js';
import { BlockDragManager } from './drag-drop.js';
import { MutationQueue } from './mutation-queue.js';
import { SpeedController } from './speed-controller.js';

const LETTER_Z_CODE = 'Z'.charCodeAt(0);
const MOVE_CYCLE_BUFFER = 600; // buffer to let the claw settle between moves

class SimulationController {
  constructor(world) {
    this.world = world;
    this.maxBlocks = window.APP_CONFIG?.MAX_BLOCKS || 26;
    this.animationDuration = window.APP_CONFIG?.ANIMATION_DURATION || 550;
    this.controlsDisabled = false;
    this.manualControlsLocked = false;
    this.allowManualDuringRun = false;
    this.isRunning = false;
    this.activePlan = [];
    this.pendingReplan = false;
    this.pendingReplanReason = null;
    this.stagedGoalTokens = null;
    this.currentGoalTokens = [];
    this.replanInFlight = null;
    this.elements = {};
    this.executedMoveCount = 0;
    this.viewportObserver = null;
    this.viewportVisibilityHandler = null;
    this.viewportCleanup = null;
    this.viewportDebounceHandle = null;
    this.pendingViewportRealign = false;

    const simulationConfig = window.APP_CONFIG?.SIMULATION || {};
    this.speedController = new SpeedController({
      baseDuration: this.animationDuration,
      minMultiplier: simulationConfig.SPEED_MIN ?? 0.25,
      maxMultiplier: simulationConfig.SPEED_MAX ?? 2,
      defaultMultiplier: simulationConfig.SPEED_DEFAULT ?? 1,
      interactionWindowMs: simulationConfig.INTERACTION_WINDOW_MS ?? 750
    });

    this.mutationQueue = new MutationQueue();
    this.dragManager = null;
  }

  initialize() {
    this.cacheDom();
    this.setupViewportGuards();
    this.setupDragManager();
    this.setupSpeedControls();
    this.bindEvents();
    this.syncBlockControls();
    this.syncSpeedUI();
    this.setManualControlsEnabled(true);
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
      loadSelect: DOM.loadSelect(),
      speedSlider: DOM.speedSlider(),
      speedValueLabel: DOM.speedValueLabel()
    };
  }

  setupDragManager() {
    if (!this.world || !this.elements.world) {
      return;
    }

    if (!this.dragManager) {
      this.dragManager = new BlockDragManager(this.world, this.elements.world);
      this.dragManager.onUserMutation = (mutation) => this.handleUserMutation(mutation);
    } else {
      this.dragManager.setWorld(this.world);
      this.dragManager.setContainer(this.elements.world);
    }

    this.dragManager.enable();
  }

  setupSpeedControls() {
    const slider = this.elements.speedSlider;
    if (!slider) {
      return;
    }
    const simulationConfig = window.APP_CONFIG?.SIMULATION || {};
    if (simulationConfig.SPEED_MIN != null) {
      slider.min = String(simulationConfig.SPEED_MIN);
    }
    if (simulationConfig.SPEED_MAX != null) {
      slider.max = String(simulationConfig.SPEED_MAX);
    }
    slider.step = slider.step || '0.05';
    slider.value = String(this.speedController.getMultiplier());
  }

  setupViewportGuards() {
    if (typeof this.viewportCleanup === 'function') {
      this.viewportCleanup();
      this.viewportCleanup = null;
    }

    const worldElem = this.elements?.world;
    if (!worldElem) {
      return;
    }

    const simulationConfig = window.APP_CONFIG?.SIMULATION || {};
    const debounceMsRaw = simulationConfig.WINDOW_RESIZE_DEBOUNCE_MS;
    const debounceMs = Number.isFinite(debounceMsRaw)
      ? Math.max(50, Math.round(debounceMsRaw))
      : 220;

    const scheduleViewportCheck = () => {
      if (this.viewportDebounceHandle) {
        window.clearTimeout(this.viewportDebounceHandle);
      }
      this.viewportDebounceHandle = window.setTimeout(() => {
        this.viewportDebounceHandle = null;
        this.handleViewportChange();
      }, debounceMs);
    };

    this.viewportVisibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        scheduleViewportCheck();
      }
    };

    window.addEventListener('resize', scheduleViewportCheck);
    window.addEventListener('orientationchange', scheduleViewportCheck);
    document.addEventListener('visibilitychange', this.viewportVisibilityHandler);

    if (typeof ResizeObserver === 'function') {
      this.viewportObserver = new ResizeObserver(() => scheduleViewportCheck());
      this.viewportObserver.observe(worldElem);
    }

    this.viewportCleanup = () => {
      window.removeEventListener('resize', scheduleViewportCheck);
      window.removeEventListener('orientationchange', scheduleViewportCheck);
      document.removeEventListener('visibilitychange', this.viewportVisibilityHandler);
      if (this.viewportObserver) {
        this.viewportObserver.disconnect();
        this.viewportObserver = null;
      }
      this.viewportVisibilityHandler = null;
      if (this.viewportDebounceHandle) {
        window.clearTimeout(this.viewportDebounceHandle);
        this.viewportDebounceHandle = null;
      }
    };

    scheduleViewportCheck();
  }

  handleViewportChange() {
    if (!this.world) {
      return;
    }

    this.world.updatePositions();

    const claw = document.getElementById('claw');
    if (!claw) {
      this.pendingViewportRealign = false;
      return;
    }

    if (this.isRunning) {
      this.pendingViewportRealign = true;
      return;
    }

    const previousTransition = claw.style.transition;
    resetClawToDefault(claw, 0);
    window.requestAnimationFrame(() => {
      claw.style.transition = previousTransition || '';
    });
    this.pendingViewportRealign = false;
  }

  applyPendingViewportRealign() {
    if (!this.pendingViewportRealign) {
      return;
    }
    this.pendingViewportRealign = false;
    this.handleViewportChange();
  }

  syncSpeedUI() {
    const { speedSlider, speedValueLabel } = this.elements;
    if (speedSlider && Number(speedSlider.value) !== this.speedController.getMultiplier()) {
      speedSlider.value = String(this.speedController.getMultiplier());
    }
    if (speedValueLabel) {
      speedValueLabel.textContent = `${this.speedController.getMultiplier().toFixed(2)}x`;
    }
  }

  setManualControlsEnabled(enabled) {
    this.manualControlsLocked = !enabled;
    this.refreshStepperAvailability();
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
    this.elements.goalInput?.addEventListener('change', () => this.handleGoalInputChange());
    if (this.elements.speedSlider) {
      const slider = this.elements.speedSlider;
      slider.addEventListener('input', (event) => this.handleSpeedSliderChange(event, { log: false }));
      slider.addEventListener('change', (event) => this.handleSpeedSliderChange(event, { log: true }));
    }

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

  syncBlockControls(forceDisabled = this.controlsDisabled && !this.allowManualDuringRun) {
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

  refreshStepperAvailability(forceDisabled = this.controlsDisabled && !this.allowManualDuringRun) {
    const { addBtn, removeBtn } = this.elements;
    if (!addBtn || !removeBtn) return;

    const shouldDisable = forceDisabled || this.manualControlsLocked;

    if (shouldDisable) {
      addBtn.disabled = true;
      removeBtn.disabled = true;
      return;
    }

    addBtn.disabled = !this.getNextBlockLetter();
    removeBtn.disabled = this.blockCount === 0;
  }

  handleBlockAddition() {
    if (this.manualControlsLocked) return;
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
      if (this.isRunning) {
        this.recordMutation({ type: 'BLOCK_ADD', block: nextLetter });
        this.requestReplan('block-added');
      }
    }
  }

  handleBlockRemoval() {
    if (this.manualControlsLocked) return;
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
      if (this.isRunning) {
        this.recordMutation({ type: 'BLOCK_REMOVE', block: targetBlock });
        this.requestReplan('block-removed');
      }
    }
  }

  handleSpeedSliderChange(event, { log = false } = {}) {
    const rawValue = Number(event?.target?.value);
    if (!Number.isFinite(rawValue)) {
      return;
    }
    const applied = this.speedController.setMultiplier(rawValue);
    this.syncSpeedUI();
    if (log) {
      logAction(`Adjusted simulation speed to ${applied.toFixed(2)}x`, 'user');
    }
  }

  handleGoalInputChange() {
    if (!this.isRunning) return;
    const rawInput = this.elements.goalInput?.value ?? '';
    const { tokens, error } = this.parseGoalInput(rawInput, { allowEmpty: true });

    if (error) {
      showMessage(error, 'warning');
      return;
    }

    if (!tokens || tokens.length === 0) {
      return;
    }

    const unknownBlocks = this.findUnknownGoalBlocks(tokens);
    if (unknownBlocks.length > 0) {
      showMessage(`Unknown blocks in goal: ${unknownBlocks.join(', ')}.`, 'error');
      return;
    }

    if (this.areGoalTokensEqual(tokens, this.currentGoalTokens)) {
      return;
    }

    this.stagedGoalTokens = tokens;
    this.recordMutation({ type: 'GOAL_SET', goals: tokens });
    this.requestReplan('goal-change');
    logAction(`Updated goal to ${tokens.join(' on ')}`, 'user');
  }

  parseGoalInput(rawInput, { allowEmpty = false } = {}) {
    const sanitized = (rawInput || '').trim();
    if (!sanitized) {
      return allowEmpty
        ? { tokens: [] }
        : { error: 'Please enter a goal (e.g., "A on B on C").' };
    }

    const tokens = sanitized
      .split(/\s*on\s*/i)
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);

    if (tokens.length === 0) {
      return allowEmpty
        ? { tokens: [] }
        : { error: 'Goal input is empty or invalid.' };
    }

    if (tokens[tokens.length - 1] !== 'TABLE') {
      tokens.push('Table');
    }

    return { tokens };
  }

  areGoalTokensEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    return a.every((token, idx) => token === b[idx]);
  }

  findUnknownGoalBlocks(tokens = []) {
    const currentBlocks = this.world.getCurrentBlocks();
    return tokens.filter((token) => token !== 'Table' && !currentBlocks.includes(token));
  }

  handleUserMutation(mutation) {
    this.recordMutation(mutation);
    if (this.isRunning) {
      this.requestReplan('manual-move');
    }
  }

  recordMutation(mutation) {
    if (!mutation || typeof mutation !== 'object') {
      return;
    }

    if (!this.isRunning) {
      this.logMutations([mutation]);
      return;
    }

    this.mutationQueue.add(mutation);
  }

  requestReplan(reason = 'manual-change') {
    if (!this.isRunning) {
      return;
    }
    if (this.pendingReplan) {
      this.pendingReplanReason = reason;
      return;
    }
    this.pendingReplan = true;
    this.pendingReplanReason = reason;
    updateStats(undefined, 'Planning');
    showMessage('Manual edit received. Re-planning before continuing...', 'info');
  }

  async handleCheckpoint() {
    const mutations = this.mutationQueue.drain();
    if (mutations.length > 0) {
      this.logMutations(mutations);
    }

    if (this.pendingReplan) {
      await this.performReplan();
    }
  }

  async performReplan() {
    if (!this.pendingReplan) return;
    if (this.replanInFlight) {
      await this.replanInFlight;
      return;
    }

    const targetGoalTokens = this.stagedGoalTokens && this.stagedGoalTokens.length > 0
      ? this.stagedGoalTokens
      : this.currentGoalTokens;

    if (!targetGoalTokens || targetGoalTokens.length === 0) {
      showMessage('Cannot re-plan without a valid goal.', 'error');
      this.isRunning = false;
      this.pendingReplan = false;
      return;
    }

    const planPromise = this.requestPlan(targetGoalTokens).then((response) => {
      if (!response.goalAchieved) {
        showMessage('Planner could not satisfy the updated goal.', 'warning');
        this.pendingReplan = false;
        this.isRunning = false;
        return response;
      }
      return response;
    }).catch((error) => {
      handleError(error, 'replan');
      this.pendingReplan = false;
      this.isRunning = false;
      return null;
    });

    this.replanInFlight = planPromise;
    const plannerResponse = await planPromise;
    this.replanInFlight = null;

    if (!plannerResponse || !this.isRunning) {
      return;
    }

    await this.applyReplanResponse(plannerResponse, targetGoalTokens);
  }

  async applyReplanResponse(plannerResponse, goalTokens) {
    this.pendingReplan = false;
    this.pendingReplanReason = null;
    this.stagedGoalTokens = null;
    this.currentGoalTokens = goalTokens;

    if (!plannerResponse.goalAchieved) {
      this.isRunning = false;
      return;
    }

    const moves = Array.isArray(plannerResponse.moves) ? [...plannerResponse.moves] : [];
    this.activePlan = moves;
    renderIntentionTimeline(
      plannerResponse.intentionLog || [],
      plannerResponse.agentCount || 1,
      { emptyMessage: 'No planner cycles required after manual update.' }
    );
    updateStats(undefined, moves.length === 0 ? 'Idle' : 'Running');

    if (moves.length === 0) {
      showMessage('Goal already satisfied after manual edits.', 'success');
    } else {
      showMessage('Plan updated after manual change. Continuing execution...', 'success');
    }
  }

  logMutations(mutations) {
    mutations.forEach((mutation) => {
      if (!mutation || typeof mutation !== 'object') return;
      switch (mutation.type) {
        case 'MOVE':
          logAction(`Manual move: ${mutation.block} -> ${mutation.to}`, 'user');
          break;
        case 'BLOCK_ADD':
          logAction(`Manual addition: added block ${mutation.block}`, 'user');
          break;
        case 'BLOCK_REMOVE':
          logAction(`Manual removal: removed block ${mutation.block}`, 'user');
          break;
        case 'GOAL_SET':
          if (Array.isArray(mutation.goals) && mutation.goals.length > 0) {
            logAction(`Manual goal update: ${mutation.goals.join(' on ')}`, 'user');
          } else {
            logAction('Manual goal update applied.', 'user');
          }
          break;
        default:
          logAction('Manual mutation applied.', 'user');
          break;
      }
    });
  }

  async requestPlan(goalTokens) {
    return requestBDIPlan(
      this.world.getCurrentStacks(),
      goalTokens,
      { maxIterations: window.APP_CONFIG?.PLANNER?.MAX_ITERATIONS || 2500 }
    );
  }

  setControlsDisabled(disabled, options = {}) {
  this.controlsDisabled = disabled;
    const { startBtn, saveBtn, loadBtn, goalInput } = this.elements;
    const allowManualInteractions = Boolean(options.allowManualInteractions);
  this.allowManualDuringRun = disabled && allowManualInteractions;

    [startBtn, saveBtn, loadBtn].forEach((element) => {
      if (element) element.disabled = disabled;
    });

    if (goalInput) {
      goalInput.disabled = disabled && !allowManualInteractions;
    }

    if (disabled) {
      showMessage('Simulation running...', 'info');
    }

    if (disabled && !allowManualInteractions) {
      this.manualControlsLocked = true;
    } else if (!disabled) {
      this.manualControlsLocked = false;
      this.allowManualDuringRun = false;
    }

    this.refreshStepperAvailability(disabled && !allowManualInteractions);
  }

  async runSimulation() {
    if (!this.world || this.isRunning) return;

    const rawGoal = this.elements.goalInput?.value ?? '';
    const { tokens: goalTokens, error } = this.parseGoalInput(rawGoal);

    if (error) {
      showMessage(error, 'error');
      return;
    }

    const unknownBlocks = this.findUnknownGoalBlocks(goalTokens);
    if (unknownBlocks.length > 0) {
      showMessage(`Unknown blocks in goal: ${unknownBlocks.join(', ')}.`, 'error');
      return;
    }

    this.currentGoalTokens = goalTokens;
    this.stagedGoalTokens = null;
    this.pendingReplan = false;
    this.mutationQueue.clear();
    this.isRunning = true;
  this.executedMoveCount = 0;

    this.setControlsDisabled(true, { allowManualInteractions: true });
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();

    resetIntentionTimeline('Requesting plan from BDI agent...');
    startPlannerClock();

    startStatsTimer();
    updateStats(undefined, 'Planning');
    logAction(`Started planning for goal: ${goalTokens.filter(token => token !== 'Table').join(' on ') || 'Table'}`, 'user');

    try {
      const plannerResponse = await this.requestPlan(goalTokens);

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
      this.isRunning = false;
      this.setManualControlsEnabled(true);
      this.dragManager?.enable();
      this.dragManager?.clearLockedBlocks?.();
      this.applyPendingViewportRealign();
    }
  }

  handlePlannerFailure(plannerResponse) {
    this.isRunning = false;
    this.pendingReplan = false;
    this.mutationQueue.clear();
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();
    this.dragManager?.clearLockedBlocks?.();
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
    this.applyPendingViewportRealign();
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
      this.setManualControlsEnabled(true);
      this.dragManager?.enable();
      this.dragManager?.clearLockedBlocks?.();
      this.isRunning = false;
      this.applyPendingViewportRealign();
      return;
    }

    this.activePlan = [...moves];
    this.pendingReplan = false;
    updateStats(undefined, 'Running');
    const completed = await this.executeMoves(moves);

    if (!completed) {
      stopPlannerClock(false);
      stopStatsTimer(false);
      updateStats(undefined, 'Interrupted');
      this.setControlsDisabled(false);
      this.setManualControlsEnabled(true);
      this.dragManager?.enable();
      this.dragManager?.clearLockedBlocks?.();
      this.isRunning = false;
      this.applyPendingViewportRealign();
      return;
    }

    this.pendingReplan = false;
    finalizeTimeline();
    stopPlannerClock(true);

    const timelineSnapshot = getIntentionTimelineSnapshot();
    const actualCycles = Array.isArray(timelineSnapshot?.log)
      ? timelineSnapshot.log.length
      : (plannerResponse.intentionLog || []).length;
    const moveCount = this.executedMoveCount;
    stopStatsTimer(true);
    updateStats(actualCycles, 'Success');
    showMessage(`Goal achieved with ${moveCount} ${moveCount === 1 ? 'move' : 'moves'} (${actualCycles} cycles).`, 'success');
    logAction(`Goal achieved with ${moveCount} ${moveCount === 1 ? 'move' : 'moves'} (${actualCycles} cycles)`, 'system');

    this.setControlsDisabled(false);
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();
    this.dragManager?.clearLockedBlocks?.();
    this.isRunning = false;
    this.applyPendingViewportRealign();
  }

  async executeMoves(moves) {
    this.activePlan = Array.isArray(this.activePlan) && this.activePlan.length > 0
      ? this.activePlan
      : Array.isArray(moves)
        ? [...moves]
        : [];

    const claw = document.getElementById('claw');
    const stepDuration = () => this.speedController.getStepDuration();
    let aborted = false;

    if (claw && this.activePlan.length > 0) {
      resetClawToDefault(claw, stepDuration());
      await this.wait(stepDuration() + MOVE_CYCLE_BUFFER);
    }

    while (this.isRunning) {
      await this.speedController.waitForWindow();

      await this.handleCheckpoint();

      if (!this.isRunning) {
        aborted = true;
        break;
      }

      if (!this.activePlan.length) {
        if (this.pendingReplan) {
          continue;
        }
        break;
      }

      const nextMove = this.activePlan.shift();
      const blockToLock = nextMove?.block;
      if (blockToLock) {
        this.dragManager?.lockBlocks([blockToLock]);
      }
      await new Promise((resolve) => {
        simulateMove(
          nextMove,
          this.world,
          this.elements.world,
          claw,
          markTimelineStep,
          () => {
            if (blockToLock) {
              this.dragManager?.unlockBlocks([blockToLock]);
            }
            resolve();
          },
          { durationMs: stepDuration() }
        );
      });
      this.executedMoveCount += 1;
    }

    this.dragManager?.clearLockedBlocks?.();
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();

    if (claw) {
      await this.wait(200);
      resetClawToDefault(claw, stepDuration());
      await this.speedController.waitForWindow();
    }

    this.applyPendingViewportRealign();
    this.activePlan = [];
    return !aborted;
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

export function setControlsDisabled(disabled, options = {}) {
  controllerInstance?.setControlsDisabled(disabled, options);
}

export function runSimulation() {
  return controllerInstance?.runSimulation();
}

export function getSimulationController() {
  return controllerInstance;
}
