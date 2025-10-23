/**
 * Simulation UI controller
 *
 * Centralises dashboard interactions: block management, planner requests,
 * persistence shortcuts, and control state synchronisation.
 */

import {
  DOM,
  resetClawToDefault,
  ensureAgentClaw,
  removeAgentClaw,
  layoutClaws,
  getAgentClaw,
  getAllAgentClaws
} from './constants.js';
import { showMessage, handleError } from './helpers.js';
import {
  resetIntentionTimeline,
  renderIntentionTimeline,
  appendNextGoalToTimeline,
  startPlannerClock,
  stopPlannerClock,
  finalizeTimeline,
  markTimelineStep,
  getIntentionTimelineSnapshot,
  handleManualIntervention
} from './timeline.js';
import { requestBDIPlan, requestMultiAgentPlan } from './planner.js';
import { simulateMove } from './animation.js';
import { saveWorld, loadSelectedWorld, refreshLoadList } from './persistence.js';
import {
  startStatsTimer,
  stopStatsTimer,
  updateStats,
  resetStats,
  resetMultiAgentStats,
  setMultiAgentStatsEnabled,
  updateMultiAgentStatsDisplay
} from './stats.js';
import { logAction } from './logger.js';
import { BlockDragManager } from './drag-drop.js';
import { MutationQueue } from './mutation-queue.js';
import { SpeedController } from './speed-controller.js';

const LETTER_Z_CODE = 'Z'.charCodeAt(0);
const MOVE_COMPLETION_BUFFER = 600; // buffer to let the claw settle between moves

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
    this.currentGoalChains = [];
    this.stagedGoalChains = null;
    this.goalSequence = [];
    this.goalSequenceIndex = 0;
    this.replanInFlight = null;
    this.elements = {};
    this.executedMoveCount = 0;
    this.viewportObserver = null;
    this.viewportVisibilityHandler = null;
    this.viewportCleanup = null;
    this.viewportDebounceHandle = null;
    this.pendingViewportRealign = false;
    this.timelineHistory = [];
    this.timelinePlan = [];
    this.manualTimelineLog = [];
    this.lastAgentCount = 1;

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
    this.claws = {};
  }

  initialize() {
    this.cacheDom();
    this.syncClawRegistry();
    this.setupViewportGuards();
    this.setupDragManager();
    this.setupSpeedControls();
    if (this.elements.multiAgentMode?.checked) {
      ensureAgentClaw('Agent-B');
    } else {
      removeAgentClaw('Agent-B');
    }
    this.refreshClawLayout({ durationMs: 0 });
    this.syncClawRegistry();
    this.bindEvents();
    this.syncBlockControls();
    this.syncSpeedUI();
    this.setManualControlsEnabled(true);
    resetStats();
    resetMultiAgentStats();
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
      speedValueLabel: DOM.speedValueLabel(),
      multiAgentMode: document.getElementById('multiAgentMode'),
      multiAgentInfo: document.getElementById('multiAgentInfo'),
      multiAgentControls: document.getElementById('multiAgentControls'),
      multiAgentStats: document.getElementById('multiAgentStats')
    };
  }

  syncClawRegistry() {
    ensureAgentClaw('Agent-A');
    const primary = getAgentClaw('Agent-A');
    const secondary = getAgentClaw('Agent-B');
    this.claws = {};
    if (primary) {
      this.claws['Agent-A'] = primary;
    }
    if (secondary) {
      this.claws['Agent-B'] = secondary;
    }
  }

  getAllClaws() {
    const worldClaws = getAllAgentClaws();
    if (worldClaws.length) {
      return worldClaws;
    }
    return Object.values(this.claws).filter((claw) => claw && claw.isConnected);
  }

  getClawForAgent(agentKey = 'Agent-A') {
    return this.claws[agentKey] || this.getAllClaws()[0] || null;
  }

  getWorldStacksSnapshot() {
    if (!this.world || typeof this.world.getCurrentStacks !== 'function') {
      return [];
    }
    return this.world.getCurrentStacks().map((stack) => [...stack]);
  }

  refreshClawLayout(options = {}) {
    layoutClaws(options);
    this.syncClawRegistry();
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

    const claws = this.getAllClaws();
    if (!claws.length) {
      this.pendingViewportRealign = false;
      return;
    }

    if (this.isRunning) {
      this.pendingViewportRealign = true;
      return;
    }

    claws.forEach((claw) => {
      if (!claw) {
        return;
      }
      const previousTransition = claw.style.transition;
      resetClawToDefault(claw, 0);
      window.requestAnimationFrame(() => {
        if (claw) {
          claw.style.transition = previousTransition || '';
        }
      });
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

    // Multi-agent mode toggle
    this.elements.multiAgentMode?.addEventListener('change', (event) => this.handleMultiAgentModeChange(event));

    document.addEventListener('world:blocks-changed', () => this.syncBlockControls());
  }

  handleMultiAgentModeChange(event) {
    const isMultiAgent = event.target.checked;
    
    // Toggle multi-agent UI elements
    if (this.elements.multiAgentInfo) {
      this.elements.multiAgentInfo.classList.toggle('hidden', !isMultiAgent);
    }

    if (isMultiAgent) {
      setMultiAgentStatsEnabled(true);
    } else {
      resetMultiAgentStats();
    }

    if (isMultiAgent) {
      ensureAgentClaw('Agent-B');
      this.refreshClawLayout({ durationMs: 200 });
    } else {
      removeAgentClaw('Agent-B');
      this.refreshClawLayout({ durationMs: 0 });
    }
    this.syncClawRegistry();
    
    // Log mode change
    logAction(`Planner mode: ${isMultiAgent ? 'Multi-Agent enabled (negotiation: ON, timeout: 5000ms)' : 'Single Agent (default)'}`, 'user');
  }

  updateMultiAgentStats(statistics) {
    if (!statistics) return;

    updateMultiAgentStatsDisplay(statistics);
    
    // Log summary
    if (statistics.totalConflicts > 0) {
      logAction(`Multi-agent: ${statistics.totalConflicts} conflicts detected, ${statistics.totalNegotiations} negotiations`, 'system');
    }
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
    const blocks = this.world.getCurrentBlocks();
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return null;
    }

    const sorted = [...blocks].sort((a, b) => b.localeCompare(a));
    return sorted.length > 0 ? sorted[0] : null;
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
    const { chains, error } = this.parseGoalInput(rawInput, { allowEmpty: true });

    if (error) {
      showMessage(error, 'warning');
      return;
    }

    if (!chains || chains.length === 0) {
      return;
    }

    const normalizedChains = this.cloneGoalChains(chains);
    const unknownBlocks = this.findUnknownGoalBlocks(normalizedChains);
    if (unknownBlocks.length > 0) {
      showMessage(`Unknown blocks in goal: ${unknownBlocks.join(', ')}.`, 'error');
      return;
    }

    if (this.areGoalChainsEqual(normalizedChains, this.currentGoalChains)) {
      return;
    }

    this.stagedGoalChains = normalizedChains;
    this.stagedGoalTokens = normalizedChains[0] ? [...normalizedChains[0]] : [];

    this.recordMutation({
      type: 'GOAL_SET',
      goalChains: normalizedChains
    });

    this.requestReplan('goal-change');
    logAction(`Updated goal to ${this.formatGoalChains(normalizedChains)}`, 'user');
  }

  normalizeGoalChainsInput(goalChains) {
    if (!Array.isArray(goalChains)) {
      return [];
    }
    const normalized = Array.isArray(goalChains[0]) ? goalChains : [goalChains];
    return normalized.filter((chain) => Array.isArray(chain) && chain.length);
  }

  cloneGoalChains(goalChains = []) {
    return this.normalizeGoalChainsInput(goalChains).map((chain) => [...chain]);
  }

  flattenGoalChains(goalChains = []) {
    const normalized = this.normalizeGoalChainsInput(goalChains);
    return normalized.reduce((acc, chain) => {
      chain.forEach((token) => acc.push(token));
      return acc;
    }, []);
  }

  formatGoalChains(goalChains = []) {
    const normalized = this.normalizeGoalChainsInput(goalChains);
    if (!normalized.length) {
      return 'Table';
    }

    return normalized
      .map((chain) => {
        const displayTokens = chain.filter((token) => token && token !== 'Table');
        return displayTokens.length ? displayTokens.join(', ') : 'Table';
      })
      .join(' | ');
  }

  cloneIntentionLogEntries(log = []) {
    if (!Array.isArray(log)) {
      return [];
    }
    return log.map((entry) => {
      const clonedEntry = { ...entry };
      if (Array.isArray(entry.moves)) {
        clonedEntry.moves = entry.moves.map(move => ({ ...move }));
      }
      if (Array.isArray(entry.resultingStacks)) {
        clonedEntry.resultingStacks = entry.resultingStacks.map(stack => Array.isArray(stack) ? [...stack] : stack);
      }
      if (entry.beliefs && typeof entry.beliefs === 'object') {
        clonedEntry.beliefs = {
          pendingRelation: entry.beliefs.pendingRelation ? { ...entry.beliefs.pendingRelation } : null,
          clearBlocks: Array.isArray(entry.beliefs.clearBlocks) ? [...entry.beliefs.clearBlocks] : [],
          onMap: entry.beliefs.onMap ? { ...entry.beliefs.onMap } : {}
        };
      }
      return clonedEntry;
    });
  }

  clonePlanMoveForTimeline(move) {
    if (!move || typeof move !== 'object') {
      return null;
    }
    const cloned = { ...move };
    if (Array.isArray(move.clawSteps)) {
      cloned.clawSteps = move.clawSteps.map((step) => (
        step && typeof step === 'object' ? { ...step } : step
      ));
    }
    return cloned;
  }

  clonePlanMovesForTimeline(planMoves = []) {
    if (!Array.isArray(planMoves)) {
      return [];
    }

    return planMoves
      .map((group) => {
        if (!group || typeof group !== 'object') {
          return null;
        }

        if (Array.isArray(group.moves)) {
          const clonedGroup = { ...group };
          clonedGroup.moves = group.moves
            .map((move) => this.clonePlanMoveForTimeline(move))
            .filter(Boolean);
          return clonedGroup;
        }

        return this.clonePlanMoveForTimeline(group);
      })
      .filter(Boolean);
  }

  renderPlannerTimeline(log = [], agentCount = 1, { append = false, emptyMessage, planMoves = null } = {}) {
    // Store plan for timeline rendering
    const clonedPlanMoves = Array.isArray(planMoves)
      ? this.clonePlanMovesForTimeline(planMoves)
      : Array.isArray(this.activePlan) && this.activePlan.length
        ? this.clonePlanMovesForTimeline(this.activePlan)
        : [];

    let effectiveAgentCount = Number.isFinite(agentCount) && agentCount > 0
      ? agentCount
      : this.lastAgentCount || 1;
    this.lastAgentCount = effectiveAgentCount;

    this.timelinePlan = clonedPlanMoves;

    // Render the entire plan as cards
    renderIntentionTimeline(log, effectiveAgentCount, {
      planMoves: this.timelinePlan,
      emptyMessage
    });
  }

  cloneStacksForTimeline(stacks = []) {
    if (!Array.isArray(stacks)) {
      return [];
    }
    return stacks.map((stack) => (Array.isArray(stack) ? [...stack] : stack));
  }

  convertMutationToTimelineMove(mutation) {
    if (!mutation || typeof mutation !== 'object') {
      return null;
    }

    const base = {
      actor: 'User',
      manual: true,
      manualType: mutation.type || 'MANUAL',
      stepType: 'MANUAL',
      timestamp: mutation.timestamp || Date.now(),
      stepLabel: 'Manual Update'
    };

    const block = typeof mutation.block === 'string' && mutation.block.trim().length
      ? mutation.block.trim()
      : 'Manual';

    switch (mutation.type) {
      case 'MOVE': {
        const destination = typeof mutation.to === 'string' && mutation.to.trim().length
          ? mutation.to.trim()
          : 'Table';
        return {
          ...base,
          block,
          to: destination,
          reason: 'manual-move',
          stepDescription: `User moved ${block} to ${destination}`,
          summary: `Manual move: ${block} → ${destination}`,
          detail: mutation.from ? `Source: ${mutation.from}` : undefined
        };
      }
      case 'BLOCK_ADD': {
        const destination = 'Table';
        return {
          ...base,
          block,
          to: destination,
          reason: 'manual-add',
          stepDescription: `User added block ${block}`,
          summary: `Block ${block} added`
        };
      }
      case 'BLOCK_REMOVE': {
        const destination = 'Removed';
        return {
          ...base,
          block,
          to: destination,
          reason: 'manual-remove',
          stepDescription: `User removed block ${block}`,
          summary: `Block ${block} removed`
        };
      }
      case 'GOAL_SET': {
        const goalLabel = this.formatGoalChains(mutation.goalChains || []);
        return {
          ...base,
          block: 'Goal',
          to: 'Updated',
          reason: 'manual-goal-update',
          stepDescription: `User updated goal to ${goalLabel}`,
          summary: 'Goal updated',
          detail: goalLabel
        };
      }
      default: {
        const typeLabel = typeof mutation.type === 'string'
          ? mutation.type.replace(/_/g, ' ')
          : 'change';
        return {
          ...base,
          block,
          to: 'Update',
          reason: 'manual-change',
          stepDescription: `User triggered a ${typeLabel}`,
          summary: `Manual update: ${typeLabel}`,
          detail: mutation.detail || mutation.reason
        };
      }
    }
  }

  appendManualTimelineEvents(mutations = []) {
    if (!Array.isArray(mutations) || !mutations.length) {
      return;
    }

    // Convert first mutation to manual move for timeline
    const mutation = mutations[0];
    const manualMove = this.convertMutationToTimelineMove(mutation);
    
    if (!manualMove) {
      return;
    }

    // Track manual intervention
    this.manualTimelineLog.push({
      manual: true,
      timestamp: mutation.timestamp || Date.now(),
      move: manualMove
    });

    // Timeline will be updated when replan completes via handleManualIntervention
  }

  setGoalSequence(goalChains = []) {
    const cloned = this.cloneGoalChains(goalChains);
    this.goalSequence = cloned;
    this.goalSequenceIndex = 0;
    this.currentGoalChains = this.cloneGoalChains(cloned);
    this.currentGoalTokens = cloned[0] ? [...cloned[0]] : [];
  }

  clearGoalSequence() {
    this.goalSequence = [];
    this.goalSequenceIndex = 0;
    this.currentGoalChains = [];
    this.currentGoalTokens = [];
    this.executedMoveCount = 0;
  }

  getActiveGoalChain() {
    if (!Array.isArray(this.goalSequence) || this.goalSequence.length === 0) {
      return [];
    }
    const clampedIndex = Math.min(
      Math.max(this.goalSequenceIndex, 0),
      this.goalSequence.length - 1
    );
    const active = this.goalSequence[clampedIndex];
    return Array.isArray(active) ? [...active] : [];
  }

  advanceGoalSequence() {
    if (!Array.isArray(this.goalSequence) || this.goalSequence.length === 0) {
      return null;
    }
    const nextIndex = this.goalSequenceIndex + 1;
    if (nextIndex >= this.goalSequence.length) {
      return null;
    }
    this.goalSequenceIndex = nextIndex;
    const nextChain = this.goalSequence[nextIndex];
    this.currentGoalTokens = Array.isArray(nextChain) ? [...nextChain] : [];
    this.currentGoalChains = this.cloneGoalChains(this.goalSequence);
    return Array.isArray(nextChain) ? [...nextChain] : null;
  }

  hasPendingGoalChains() {
    return Array.isArray(this.goalSequence) && this.goalSequenceIndex < this.goalSequence.length - 1;
  }

  parseGoalInput(rawInput, { allowEmpty = false } = {}) {
    const sanitized = (rawInput || '').trim();
    if (!sanitized) {
      return allowEmpty
        ? { chains: [], tokens: [] }
  : { error: 'Please enter a goal (e.g., "A, B | C, D").' };
    }

    const normalizedInput = sanitized.replace(/\s+/g, ' ');
    const rawSegments = normalizedInput
      .split(/\s*(?:\band\b|&|;|\|)\s*/i)
      .map((segment) => segment.trim())
      .filter(Boolean);

    const chains = [];

    const pushChain = (chainTokens, originalSegment) => {
      const filtered = chainTokens
        .map((token) => token.trim().toUpperCase())
        .filter(Boolean)
        .map((token) => (token === 'TABLE' ? 'Table' : token));

      if (filtered.length === 0) {
        return;
      }

      if (filtered.length === 1) {
        filtered.push('Table');
      }

      if (filtered[filtered.length - 1] !== 'Table') {
        filtered.push('Table');
      }

      if (filtered.length < 2) {
        chains.length = 0;
  throw new Error(`Segment "${originalSegment}" is incomplete. Use syntax like "A, B" or separate towers with "|".`);
      }

      chains.push(filtered);
    };

    try {
      if (rawSegments.length === 0) {
        const fallbackTokens = normalizedInput
          .split(/\s*on\s*/i)
          .map((token) => token.trim())
          .filter(Boolean);
        pushChain(fallbackTokens, normalizedInput);
      } else {
        rawSegments.forEach((segment) => {
          if (/\bon\b/i.test(segment)) {
            const parts = segment.split(/\s*on\s*/i);
            pushChain(parts, segment);
          } else {
            const parts = segment.split(/\s*,\s*/);
            pushChain(parts, segment);
          }
        });
      }
    } catch (error) {
      return { error: error.message };
    }

    if (chains.length === 0) {
      return allowEmpty
        ? { chains: [], tokens: [] }
        : { error: 'Goal input is empty or invalid.' };
    }

    const flattened = this.flattenGoalChains(chains).filter((token) => token !== 'Table');
    const seen = new Set();
    const duplicates = new Set();
    flattened.forEach((token) => {
      if (seen.has(token)) {
        duplicates.add(token);
      } else {
        seen.add(token);
      }
    });

    if (duplicates.size > 0) {
      return { error: `Duplicate blocks in goal: ${Array.from(duplicates).join(', ')}.` };
    }

    return { chains, tokens: chains[0] || [] };
  }

  areGoalChainsEqual(a = [], b = []) {
    const left = this.normalizeGoalChainsInput(a);
    const right = this.normalizeGoalChainsInput(b);
    if (left.length !== right.length) {
      return false;
    }
    return left.every((chain, idx) => {
      const other = right[idx];
      if (!Array.isArray(chain) || !Array.isArray(other)) {
        return false;
      }
      if (chain.length !== other.length) {
        return false;
      }
      return chain.every((token, tokenIdx) => token === other[tokenIdx]);
    });
  }

  findUnknownGoalBlocks(goalStructure = []) {
    const currentBlocks = this.world.getCurrentBlocks();
    const tokens = this.flattenGoalChains(goalStructure);
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

    const enriched = {
      ...mutation,
      timelineSnapshot: this.getWorldStacksSnapshot()
    };

    if (!this.isRunning) {
      this.logMutations([enriched]);
      return;
    }

    this.mutationQueue.add(enriched);
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

    const hasStagedSequence = Array.isArray(this.stagedGoalChains) && this.stagedGoalChains.length > 0;
    const stagedSequence = hasStagedSequence ? this.cloneGoalChains(this.stagedGoalChains) : null;
    const targetGoalTokens = hasStagedSequence
      ? (stagedSequence[0] ? [...stagedSequence[0]] : [])
      : this.getActiveGoalChain();

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
      this.stagedGoalTokens = null;
      this.stagedGoalChains = null;
      return null;
    });

    this.replanInFlight = planPromise;
    const plannerResponse = await planPromise;
    this.replanInFlight = null;

    if (!plannerResponse || !this.isRunning) {
      return;
    }

    await this.applyReplanResponse(plannerResponse, targetGoalTokens, stagedSequence);
  }

  async applyReplanResponse(plannerResponse, goalTokens, goalChains = null) {
    this.pendingReplan = false;
    this.pendingReplanReason = null;
    this.stagedGoalTokens = null;
    this.stagedGoalChains = null;

    if (Array.isArray(goalChains) && goalChains.length > 0) {
      this.setGoalSequence(goalChains);
    } else if (Array.isArray(goalTokens) && goalTokens.length > 0) {
      this.currentGoalTokens = [...goalTokens];
      if (Array.isArray(this.goalSequence) && this.goalSequence.length > 0) {
        this.goalSequence[this.goalSequenceIndex] = [...goalTokens];
        this.currentGoalChains = this.cloneGoalChains(this.goalSequence);
      } else {
        this.currentGoalChains = [[...this.currentGoalTokens]];
      }
    } else {
      this.clearGoalSequence();
    }

    if (!plannerResponse.goalAchieved) {
      this.isRunning = false;
      return;
    }

    const moves = Array.isArray(plannerResponse.moves) ? [...plannerResponse.moves] : [];
    this.activePlan = moves;
    
    // Get the most recent manual move from the log
    const manualMove = this.manualTimelineLog.length > 0
      ? this.manualTimelineLog[this.manualTimelineLog.length - 1].move
      : null;

    // Use handleManualIntervention to update timeline
    if (manualMove) {
      handleManualIntervention(manualMove, moves);
    } else {
      // No manual intervention, just render the new plan
      this.timelineHistory = [];
      this.timelinePlan = [];
      this.renderPlannerTimeline(
        plannerResponse.intentionLog || [],
        plannerResponse.agentCount || 1,
        {
          emptyMessage: 'No planner steps required after manual update.',
          planMoves: plannerResponse.moves || []
        }
      );
    }
    
    updateStats(undefined, moves.length === 0 ? 'Idle' : 'Running');

    if (moves.length === 0) {
      showMessage('Goal already satisfied after manual edits.', 'success');
    } else {
      showMessage('Plan updated after manual change. Continuing execution...', 'success');
    }
  }

  logMutations(mutations) {
    if (!Array.isArray(mutations) || !mutations.length) {
      return;
    }

    const timelineEligible = [];

    mutations.forEach((mutation) => {
      if (!mutation || typeof mutation !== 'object') return;

      timelineEligible.push(mutation);

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
        case 'GOAL_SET': {
          const formatted = Array.isArray(mutation.goalChains) && mutation.goalChains.length > 0
            ? this.formatGoalChains(mutation.goalChains)
            : Array.isArray(mutation.goals) && mutation.goals.length > 0
              ? mutation.goals.join(', ')
              : null;
          if (formatted) {
            logAction(`Manual goal update: ${formatted}`, 'user');
          } else {
            logAction('Manual goal update applied.', 'user');
          }
          break;
        }
        default:
          logAction('Manual mutation applied.', 'user');
          break;
      }
    });

    if (timelineEligible.length) {
      this.appendManualTimelineEvents(timelineEligible);
    }
  }

  async requestPlan(goalTokens) {
    const goalChain = Array.isArray(goalTokens) ? [...goalTokens] : [];
    if (!goalChain.length) {
      throw new Error('Planner requested without a goal chain.');
    }

    const currentStacks = typeof this.world.getCurrentStacks === 'function'
      ? this.world.getCurrentStacks()
      : this.world.getStacks?.();

    const isMultiAgent = document.getElementById('multiAgentMode')?.checked || false;

    if (isMultiAgent) {
      const enableNegotiation = true;
      const deliberationTimeout = 5000;
      const fullGoalChains = Array.isArray(this.goalSequence) && this.goalSequence.length > 0
        ? this.cloneGoalChains(this.goalSequence)
        : [goalChain];

      return requestMultiAgentPlan(
        currentStacks,
        goalChain,
        {
          maxIterations: 2500,
          deliberationTimeout,
          enableNegotiation,
          goalChains: fullGoalChains
        }
      );
    }

    return requestBDIPlan(
      currentStacks,
      goalChain,
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
    const { chains: goalChains, error } = this.parseGoalInput(rawGoal);

    if (error) {
      showMessage(error, 'error');
      return;
    }

    if (!goalChains || goalChains.length === 0) {
  showMessage('Please provide at least one valid goal (e.g., "A, B").', 'error');
      return;
    }

    const normalizedChains = this.cloneGoalChains(goalChains);
    const unknownBlocks = this.findUnknownGoalBlocks(normalizedChains);
    if (unknownBlocks.length > 0) {
      showMessage(`Unknown blocks in goal: ${unknownBlocks.join(', ')}.`, 'error');
      return;
    }

    this.clearGoalSequence();
    this.setGoalSequence(normalizedChains);
    this.stagedGoalTokens = null;
    this.stagedGoalChains = null;
    this.pendingReplan = false;
    this.mutationQueue.clear();
    this.isRunning = true;
    this.executedMoveCount = 0;
    this.timelineHistory = [];
    this.timelinePlan = [];
    this.manualTimelineLog = [];
    this.lastAgentCount = 1;

    this.setControlsDisabled(true, { allowManualInteractions: true });
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();

    resetIntentionTimeline('Requesting plan from BDI agent...');
    startPlannerClock();

    startStatsTimer();
    updateStats(undefined, 'Planning');
    logAction(`Started planning for goal: ${this.formatGoalChains(normalizedChains)}`, 'user');

    try {
      const goalTokens = this.getActiveGoalChain();
      if (!goalTokens.length) {
        throw new Error('No active goal chain available for planning.');
      }
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
      this.timelineHistory = [];
      this.timelinePlan = [];
      this.manualTimelineLog = [];
      this.lastAgentCount = 1;
      stopStatsTimer(false);
      updateStats(undefined, 'Unexpected Error');
      this.setControlsDisabled(false);
      this.isRunning = false;
      this.setManualControlsEnabled(true);
      this.dragManager?.enable();
      this.dragManager?.clearLockedBlocks?.();
      this.stagedGoalTokens = null;
      this.stagedGoalChains = null;
      this.clearGoalSequence();
      this.applyPendingViewportRealign();
    }
  }

  handlePlannerFailure(plannerResponse) {
    this.isRunning = false;
    this.pendingReplan = false;
    this.mutationQueue.clear();
    this.clearGoalSequence();
    this.stagedGoalTokens = null;
    this.stagedGoalChains = null;
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();
    this.dragManager?.clearLockedBlocks?.();
    showMessage('Planner could not achieve the goal within the iteration limit.', 'warning');
    this.timelineHistory = [];
    this.timelinePlan = [];
    this.manualTimelineLog = [];
    this.lastAgentCount = 1;
    this.renderPlannerTimeline(
      plannerResponse.intentionLog || [],
      plannerResponse.agentCount || 1,
      {
        emptyMessage: 'Planner did not complete successfully.',
        planMoves: plannerResponse.moves || []
      }
    );

  stopPlannerClock(true);
  stopStatsTimer(true);
  const totalMoves = this.executedMoveCount;
  updateStats(totalMoves, 'Failure');
    logAction(`Goal failed with ${totalMoves} ${totalMoves === 1 ? 'move' : 'moves'}`, 'system');
    this.setControlsDisabled(false);
    this.applyPendingViewportRealign();
  }

  async handlePlannerSuccess(plannerResponse, options = {}) {
    const { appendTimeline = false, goalLabel = null } = options;

    const normalizedLog = Array.isArray(plannerResponse.intentionLog)
      ? plannerResponse.intentionLog.map((cycle, idx) => {
          if (!cycle || typeof cycle !== 'object') {
            return cycle;
          }
          const clone = { ...cycle };
          if (idx === 0 && goalLabel) {
            clone.sequenceLabel = goalLabel;
          }
          return clone;
        })
      : [];

    const isMultiAgent = plannerResponse.statistics?.agentAMoves !== undefined;
    const agentCount = plannerResponse.agentCount || (isMultiAgent ? 2 : 1);

    if (plannerResponse.planningApproach === 'multi-tower-independent' && Array.isArray(this.goalSequence) && this.goalSequence.length > 0) {
      this.goalSequenceIndex = this.goalSequence.length - 1;
      this.currentGoalChains = this.cloneGoalChains(this.goalSequence);
    }

    // For next goal in sequence, append to existing timeline with transition card
    if (appendTimeline && goalLabel) {
      appendNextGoalToTimeline(goalLabel, plannerResponse.moves || []);
    } else {
      // Initial goal or non-sequence - render fresh timeline
      this.renderPlannerTimeline(normalizedLog, agentCount, {
        append: appendTimeline,
        planMoves: plannerResponse.moves || []
      });
    }

    if (isMultiAgent) {
      this.updateMultiAgentStats(plannerResponse.statistics);
    }

    const moves = Array.isArray(plannerResponse.moves) ? [...plannerResponse.moves] : [];

    if (moves.length > 0) {
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
    } else {
      this.activePlan = [];
      this.pendingReplan = false;
      if (this.hasPendingGoalChains()) {
        showMessage('Current goal already satisfied - moving to next goal.', 'info');
      }
    }

  finalizeTimeline();
  stopPlannerClock(true);

    if (this.hasPendingGoalChains()) {
      const nextGoalChain = this.advanceGoalSequence();
      if (nextGoalChain) {
        const nextGoalLabel = this.formatGoalChains([nextGoalChain]);
        showMessage(`Proceeding to next goal: ${nextGoalLabel}`, 'info');
        updateStats(undefined, 'Planning');
        startPlannerClock();
        logAction(`Proceeding to next goal: ${nextGoalLabel}`, 'system');
        try {
          const nextResponse = await this.requestPlan(nextGoalChain);
          if (!nextResponse.goalAchieved) {
            this.handlePlannerFailure(nextResponse);
            return;
          }
          await this.handlePlannerSuccess(nextResponse, {
            appendTimeline: true,
            goalLabel: nextGoalLabel
          });
          return;
        } catch (error) {
          handleError(error, 'planning');
          stopPlannerClock(false);
          resetIntentionTimeline('Planner request failed.');
          this.timelineHistory = [];
          this.timelinePlan = [];
          this.manualTimelineLog = [];
          this.lastAgentCount = 1;
          stopStatsTimer(false);
          updateStats(undefined, 'Unexpected Error');
          this.setControlsDisabled(false);
          this.isRunning = false;
          this.setManualControlsEnabled(true);
          this.dragManager?.enable();
          this.dragManager?.clearLockedBlocks?.();
          this.stagedGoalTokens = null;
          this.stagedGoalChains = null;
          this.clearGoalSequence();
          this.applyPendingViewportRealign();
          return;
        }
      }
    }

    this.pendingReplan = false;

    const totalMoves = this.executedMoveCount;
    const goalSummary = this.formatGoalChains(
      this.currentGoalChains && this.currentGoalChains.length > 0
        ? this.currentGoalChains
        : this.goalSequence
    );

    stopStatsTimer(true);
    updateStats(totalMoves, 'Success');
    showMessage(`Goal sequence (${goalSummary}) achieved with ${totalMoves} ${totalMoves === 1 ? 'move' : 'moves'}.`, 'success');
    logAction(`Goal sequence (${goalSummary}) achieved with ${totalMoves} ${totalMoves === 1 ? 'move' : 'moves'}`, 'system');

    this.setControlsDisabled(false);
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();
    this.dragManager?.clearLockedBlocks?.();
    this.isRunning = false;
    this.stagedGoalTokens = null;
    this.stagedGoalChains = null;
    this.clearGoalSequence();
    this.applyPendingViewportRealign();
  }

  async executeMoves(moves) {
    this.activePlan = Array.isArray(this.activePlan) && this.activePlan.length > 0
      ? this.activePlan
      : Array.isArray(moves)
        ? [...moves]
        : [];
    this.syncClawRegistry();

    const stepDuration = () => this.speedController.getStepDuration();
    let aborted = false;

    const availableClaws = this.getAllClaws();

    if (availableClaws.length && this.activePlan.length > 0) {
      availableClaws.forEach((clawElem) => resetClawToDefault(clawElem, stepDuration()));
  await this.wait(stepDuration() + MOVE_COMPLETION_BUFFER);
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

      const nextMoveGroup = this.activePlan.shift();
      console.log('[EXEC] nextMoveGroup:', nextMoveGroup);
      
      const moveBatch = Array.isArray(nextMoveGroup?.moves)
        ? nextMoveGroup.moves.filter(Boolean)
        : nextMoveGroup
          ? [nextMoveGroup]
          : [];

      console.log('[EXEC] moveBatch.length:', moveBatch.length);

      if (!moveBatch.length) {
        continue;
      }

      const preparedMoves = moveBatch.map((move) => {
        const agentKey = move?.actor || move?.agent || 'Agent-A';
        const claw = this.getClawForAgent(agentKey) || this.getClawForAgent('Agent-A');
        console.log(`[EXEC] Preparing ${agentKey}: ${move.block} → ${move.to}, claw:`, claw?.id);
        return { move, agentKey, claw };
      });
      
      console.log('[EXEC] Will execute', preparedMoves.length, 'moves in parallel');

      const missingClaw = preparedMoves.some(({ claw }) => !claw);
      if (missingClaw) {
        showMessage('No available robotic arm to execute the next move batch. Stopping simulation.', 'error');
        aborted = true;
        break;
      }

      const usedClaws = new Set();
      const reusedClaw = preparedMoves.some(({ claw }) => {
        if (usedClaws.has(claw)) {
          return true;
        }
        usedClaws.add(claw);
        return false;
      });
      if (reusedClaw) {
        showMessage('Planner assigned multiple moves to the same robotic arm simultaneously. Stopping simulation.', 'error');
        aborted = true;
        break;
      }

      // Cancel any active drags before starting animations
      const blocksToAnimate = preparedMoves.map(({ move }) => move.block);
      const hadActiveDrag = blocksToAnimate.some(block => 
        this.dragManager?.isBlockBeingDragged(block)
      );
      
      if (hadActiveDrag) {
        console.log('[EXEC] Cancelling active drag before animation');
        this.dragManager.forceCancelDrag();
        // Small delay to ensure block is reattached properly
        await this.wait(50);
      }

      const promises = preparedMoves.map(({ move, claw }) => {
        const blockToLock = move?.block;
        
        if (blockToLock) {
          this.dragManager?.lockBlocks([blockToLock]);
        }

        console.log(`[EXEC] Launching simulateMove for ${move.actor || 'unknown'}: ${move.block} → ${move.to}`);

        return new Promise((resolve) => {
          simulateMove(
            move,
            this.world,
            this.elements.world,
            claw,
            markTimelineStep,
            () => {
              console.log(`[EXEC] Completed simulateMove for ${move.actor || 'unknown'}: ${move.block}`);
              if (blockToLock) {
                this.dragManager?.unlockBlocks([blockToLock]);
              }
              resolve();
            },
            { durationMs: stepDuration() }
          );
        });
      });

      console.log('[EXEC] Waiting for', promises.length, 'parallel animations...');
      await Promise.all(promises);
      console.log('[EXEC] All parallel animations completed');
      
      // Update all DOM positions after parallel animations complete
      this.world.updatePositions();
      console.log('[EXEC] World positions synchronized');
      
      this.executedMoveCount += moveBatch.length;
    }

    this.dragManager?.clearLockedBlocks?.();
    this.setManualControlsEnabled(true);
    this.dragManager?.enable();

    const finalClaws = this.getAllClaws();
    if (finalClaws.length) {
      await this.wait(200);
      finalClaws.forEach((clawElem) => resetClawToDefault(clawElem, stepDuration()));
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

export function initializeHandlers(world) {
  const controller = new SimulationController(world);
  controller.initialize();
  return controller;
}
