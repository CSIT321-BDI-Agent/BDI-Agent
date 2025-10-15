/**
 * Timeline Management System
 *
 * Handles planner timeline rendering, state transitions, and clock display.
 */

import { DOM } from './constants.js';
import { incrementStep } from './stats.js';
import { formatPlannerDuration } from './helpers.js';

const ENTRY_BASE_CLASS = 'border border-slate-200 bg-white/95 p-4 shadow-card transition-all duration-200';
const ENTRY_ACTIVE_CLASSES = ['border-brand-primary', 'ring-2', 'ring-brand-primary/40'];
const ENTRY_COMPLETED_CLASSES = ['border-green-300', 'bg-green-50'];
const ENTRY_NO_ACTION_CLASSES = ['border-dashed', 'border-slate-300', 'bg-slate-100'];

const MOVE_BASE_CLASS = 'border-l-2 border-transparent pl-2 text-xs leading-5 text-slate-600 transition-colors duration-150';
const MOVE_PENDING_CLASSES = ['border-slate-200', 'text-slate-600'];
const MOVE_DONE_CLASSES = ['border-brand-primary', 'text-brand-dark', 'font-semibold'];
const MOVE_SKIP_CLASSES = ['border-slate-300', 'text-slate-400', 'italic'];
const MOVE_INFO_CLASSES = ['text-slate-400'];

const TIMELINE_EMPTY_CLASS = 'border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-medium text-slate-500';
const STEP_BADGE_CLASS = 'mt-2 inline-flex w-fit items-center justify-center rounded-full bg-brand-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-primary';
const SKIP_BADGE_CLASS = 'mt-2 inline-flex w-fit items-center justify-center rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600';
const BELIEF_META_CLASS = 'mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-600';

// Timeline state
let intentionTimelineState = null;
let plannerClockInterval = null;
let plannerClockStart = null;
let lastRenderedLog = null;
let lastRenderedAgentCount = 0;
let lastRenderedOptions = {};

const applyClasses = (element, classes, shouldApply) => {
  classes.forEach(cls => element.classList.toggle(cls, Boolean(shouldApply)));
};

const setEntryVisualState = (entry, visual = {}) => {
  const { active = false, completed = false, noActions = false } = visual;
  applyClasses(entry, ENTRY_ACTIVE_CLASSES, active && !completed);
  applyClasses(entry, ENTRY_COMPLETED_CLASSES, completed);
  applyClasses(entry, ENTRY_NO_ACTION_CLASSES, noActions);
  entry.dataset.state = completed ? 'completed' : active ? 'active' : 'pending';
  entry.dataset.noActions = noActions ? 'true' : 'false';
};

const setMoveVisualState = (element, state = 'pending') => {
  applyClasses(element, MOVE_PENDING_CLASSES, state === 'pending');
  applyClasses(element, MOVE_DONE_CLASSES, state === 'done');
  applyClasses(element, MOVE_SKIP_CLASSES, state === 'skip');
  applyClasses(element, MOVE_INFO_CLASSES, state === 'informational');
  element.dataset.state = state;
};

const humanizeTimelineLabel = (input) => {
  if (!input) return '';
  const normalized = String(input)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized
    .split(' ')
    .map(segment => segment ? segment[0].toUpperCase() + segment.slice(1).toLowerCase() : '')
    .join(' ');
};

const formatPendingRelation = (pendingRelation) => {
  if (!pendingRelation || typeof pendingRelation !== 'object') {
    return 'none';
  }
  const block = pendingRelation.block || '?';
  const destination = pendingRelation.destination || 'Table';
  return `${block} -> ${destination}`;
};

/**
 * Update planner clock display
 * @param {string} text - Text to display
 */
export function updatePlannerClockDisplay(text) {
  const elem = DOM.plannerClock();
  if (elem) {
    elem.textContent = text ?? '--:--';
  }
}

/**
 * Stop the planner clock
 * @param {boolean} finalize - Whether to finalize with current time
 */
export function stopPlannerClock(finalize = false) {
  if (plannerClockInterval) {
    clearInterval(plannerClockInterval);
    plannerClockInterval = null;
  }
  if (plannerClockStart && finalize) {
    updatePlannerClockDisplay(formatPlannerDuration(Date.now() - plannerClockStart));
  } else if (!finalize) {
    updatePlannerClockDisplay('--:--');
  }
  plannerClockStart = null;
}

/**
 * Start the planner clock
 */
export function startPlannerClock() {
  stopPlannerClock(false);
  plannerClockStart = Date.now();
  updatePlannerClockDisplay('00:00.00');
  plannerClockInterval = setInterval(() => {
    if (!plannerClockStart) return;
    updatePlannerClockDisplay(formatPlannerDuration(Date.now() - plannerClockStart));
  }, 125);
}

/**
 * Reset intention timeline to initial state
 * @param {string} message - Message to display
 */
export function resetIntentionTimeline(message = 'No planner data yet.') {
  intentionTimelineState = null;
  lastRenderedLog = null;
  lastRenderedAgentCount = 0;
  lastRenderedOptions = {};
  const container = DOM.intentionTimeline();
  if (!container) return;
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = TIMELINE_EMPTY_CLASS;
  empty.textContent = message;
  container.appendChild(empty);
}

/**
 * Render the intention timeline from planner log
 * @param {Array} intentionLog - Array of planner cycles
 * @param {number} agentCount - Number of agents
 * @param {Object} options - Rendering options
 */
export function renderIntentionTimeline(intentionLog = [], agentCount = 0, options = {}) {
  const container = DOM.intentionTimeline();
  intentionTimelineState = null;
  if (!container) return;
  container.innerHTML = '';

  const optionsCopy = { ...(options || {}) };
  const durationsFromOptions = Array.isArray(optionsCopy.prefillDurations)
    ? [...optionsCopy.prefillDurations]
    : null;
  delete optionsCopy.prefillDurations;

  const emptyMessage = optionsCopy.emptyMessage || 'Planner has not produced any cycles yet.';

  if (!Array.isArray(intentionLog) || intentionLog.length === 0) {
    const empty = document.createElement('div');
    empty.className = TIMELINE_EMPTY_CLASS;
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const state = {
    agentCount,
    cycles: [],
    currentCycle: 0
  };

  intentionLog.forEach((cycle, idx) => {
    const entry = document.createElement('div');
    entry.className = ENTRY_BASE_CLASS;
    entry.dataset.cycleIndex = String(idx);

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between gap-3';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'flex flex-col';

    const title = document.createElement('span');
    title.className = 'text-sm font-semibold text-brand-dark';
    const cycleNumber = Number.isFinite(cycle?.cycle) ? cycle.cycle : idx + 1;
    title.textContent = `Cycle ${cycleNumber}`;
    titleGroup.appendChild(title);

    const moves = Array.isArray(cycle?.moves) ? cycle.moves : [];
    const primaryMove = moves.find(move => move && (move.block || move.skipped));

    if (primaryMove && (primaryMove.stepType || primaryMove.stepDescription || primaryMove.stepNumber != null)) {
      const badge = document.createElement('span');
      const labelSource = primaryMove.stepDescription || primaryMove.stepType || primaryMove.reason;
      const label = humanizeTimelineLabel(labelSource || 'Action');
      const hasStepInfo = Number.isFinite(primaryMove.stepNumber) && Number.isFinite(primaryMove.totalSteps);
      badge.className = STEP_BADGE_CLASS;
      badge.textContent = hasStepInfo
        ? `Step ${primaryMove.stepNumber}/${primaryMove.totalSteps} | ${label}`
        : label;
      titleGroup.appendChild(badge);
    } else if (primaryMove && primaryMove.skipped) {
      const badge = document.createElement('span');
      const reasonLabel = humanizeTimelineLabel(primaryMove.reason || 'Skipped');
    badge.className = SKIP_BADGE_CLASS;
    badge.textContent = `Skipped | ${reasonLabel}`;
      titleGroup.appendChild(badge);
    }

    header.appendChild(titleGroup);

    const time = document.createElement('span');
    time.className = 'text-xs font-mono text-brand-dark/60';
    time.textContent = '--:--';
    header.appendChild(time);

    entry.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'mt-3 flex flex-col gap-2';

    const moveStates = [];
    let totalActionMoves = 0;

    moves.forEach((move, moveIdx) => {
      const metadata = { ...(move || {}) };
      const item = document.createElement('li');
      item.className = MOVE_BASE_CLASS;

      let description = 'No planner actions recorded.';
      let moveState = 'informational';
      const isAction = Boolean(metadata.block);

      if (isAction) {
        totalActionMoves += 1;
        const actor = metadata.actor || `Agent ${moveIdx + 1}`;
        const stepLabel = humanizeTimelineLabel(metadata.stepDescription || metadata.stepType || metadata.reason || 'Action');
        const hasStepInfo = Number.isFinite(metadata.stepNumber) && Number.isFinite(metadata.totalSteps);
        const stepInfo = hasStepInfo
          ? `Step ${metadata.stepNumber}/${metadata.totalSteps}`
          : Number.isFinite(metadata.stepNumber)
            ? `Step ${metadata.stepNumber}`
            : null;
        const destinationLabel = metadata.to && metadata.to !== 'claw'
          ? `-> ${metadata.to}`
          : metadata.to === 'claw'
            ? 'Holding'
            : null;

        const summaryParts = [actor];
        if (stepInfo) summaryParts.push(stepInfo);
        summaryParts.push(stepLabel);
        if (destinationLabel) summaryParts.push(destinationLabel);
        description = summaryParts.filter(Boolean).join(' | ');

        if (metadata.stepDescription && metadata.stepDescription !== stepLabel) {
          description += ` - ${metadata.stepDescription}`;
        }

        moveState = 'pending';
      } else if (metadata.skipped) {
        const actor = metadata.actor || `Agent ${moveIdx + 1}`;
        const reasonLabel = humanizeTimelineLabel(metadata.reason || 'No Action');
        description = `${actor} | Skipped (${reasonLabel})`;
        moveState = 'skip';
      } else if (metadata.reason) {
        description = humanizeTimelineLabel(metadata.reason);
      }

      item.textContent = description;
      if (metadata.stepNumber != null) {
        item.dataset.stepNumber = String(metadata.stepNumber);
      }
      if (metadata.stepType) {
        item.dataset.stepType = metadata.stepType;
      }
      if (metadata.block) {
        item.dataset.block = metadata.block;
      }

      setMoveVisualState(item, moveState);
      list.appendChild(item);

      moveStates.push({
        meta: metadata,
        element: item,
        completed: moveState !== 'pending',
        isAction
      });
    });

    entry.appendChild(list);

    if (cycle?.beliefs) {
      const beliefMeta = document.createElement('div');
      beliefMeta.className = BELIEF_META_CLASS;
      const pendingRelation = formatPendingRelation(cycle.beliefs.pendingRelation);
      const clearBlocks = Array.isArray(cycle.beliefs.clearBlocks) && cycle.beliefs.clearBlocks.length
        ? cycle.beliefs.clearBlocks.join(', ')
        : 'none';
    beliefMeta.textContent = `Beliefs | Pending: ${pendingRelation} | Clear: ${clearBlocks}`;
      entry.appendChild(beliefMeta);
    }

    container.appendChild(entry);

    const cycleState = {
      index: idx,
      entryElement: entry,
      timeElement: time,
      moveStates,
      totalMoves: totalActionMoves,
      processedMoves: moveStates.filter(ms => ms.isAction && ms.completed).length,
      visual: {
        active: false,
        completed: false,
        noActions: totalActionMoves === 0
      }
    };

    if (cycleState.visual.noActions) {
      cycleState.visual.completed = true;
    }

    setEntryVisualState(entry, cycleState.visual);

    if (durationsFromOptions && (typeof durationsFromOptions[idx] === 'string' || typeof durationsFromOptions[idx] === 'number')) {
      const rawDuration = durationsFromOptions[idx];
      const formattedDuration =
        typeof rawDuration === 'number' ? formatPlannerDuration(rawDuration) : String(rawDuration);
      cycleState.timeElement.textContent = formattedDuration;
    }

    state.cycles.push(cycleState);
  });

  intentionTimelineState = state;
  const firstActionIndex = state.cycles.findIndex(cycle => cycle.totalMoves > 0);
  if (firstActionIndex >= 0) {
    setActiveTimelineCycle(firstActionIndex);
  }

  try {
    lastRenderedLog = JSON.parse(JSON.stringify(intentionLog));
  } catch (error) {
    lastRenderedLog = Array.isArray(intentionLog) ? [...intentionLog] : null;
  }
  lastRenderedAgentCount = agentCount;
  lastRenderedOptions = { ...optionsCopy };
}

/**
 * Set active timeline cycle
 * @param {number} index - Cycle index
 */
function setActiveTimelineCycle(index) {
  if (!intentionTimelineState || !Array.isArray(intentionTimelineState.cycles)) return;
  intentionTimelineState.cycles.forEach((cycle, idx) => {
    const shouldBeActive = idx === index && cycle.totalMoves > 0 && !cycle.visual.completed;
    cycle.visual.active = shouldBeActive;
    setEntryVisualState(cycle.entryElement, cycle.visual);
  });
}

/**
 * Complete a timeline cycle
 * @param {Object} cycleState - Cycle state object
 */
function completeTimelineCycle(cycleState) {
  if (!cycleState) return;
  cycleState.visual.completed = true;
  cycleState.visual.active = false;
  setEntryVisualState(cycleState.entryElement, cycleState.visual);
  if (plannerClockStart) {
    cycleState.timeElement.textContent = formatPlannerDuration(Date.now() - plannerClockStart);
  }
}

function matchesTimelineMove(step, moveMeta) {
  if (!step || !moveMeta) {
    return false;
  }

  const stepNumber = Number.isFinite(step.stepNumber) ? Number(step.stepNumber) : null;
  const metaStepNumber = Number.isFinite(moveMeta.stepNumber) ? Number(moveMeta.stepNumber) : null;
  if (stepNumber !== null && metaStepNumber !== null && stepNumber !== metaStepNumber) {
    return false;
  }

  const stepType = (step.type || step.stepType || '').toUpperCase();
  const metaStepType = (moveMeta.stepType || '').toUpperCase();
  if (stepType && metaStepType && stepType !== metaStepType) {
    return false;
  }

  const stepBlock = (step.block || '').toUpperCase();
  const metaBlock = (moveMeta.block || '').toUpperCase();
  if (stepBlock && metaBlock && stepBlock !== metaBlock) {
    return false;
  }

  return true;
}

/**
 * Mark a claw step as completed in the timeline
 * Each claw action (move/pick/move/drop) counts as one cycle
 * @param {Object} step - Step object {type, block, to, stepNumber}
 */
export function markTimelineStep(step) {
  if (!step || !intentionTimelineState) return;

  incrementStep();

  for (const cycleState of intentionTimelineState.cycles) {
    if (cycleState.totalMoves === 0) continue;
    if (cycleState.processedMoves >= cycleState.totalMoves) continue;

    let matcher = cycleState.moveStates.find(ms => ms.isAction && !ms.completed && matchesTimelineMove(step, ms.meta));

    if (!matcher) {
      matcher = cycleState.moveStates.find(ms => ms.isAction && !ms.completed);
    }

    if (matcher) {
      matcher.completed = true;
      setMoveVisualState(matcher.element, 'done');
      cycleState.processedMoves += 1;

      if (cycleState.processedMoves >= cycleState.totalMoves) {
        completeTimelineCycle(cycleState);
        const nextIndex = cycleState.index + 1;
        const nextActionIndex = intentionTimelineState.cycles.findIndex((c, idx) =>
          idx >= nextIndex && c.totalMoves > 0 && c.processedMoves < c.totalMoves
        );
        if (nextActionIndex >= 0) {
          setActiveTimelineCycle(nextActionIndex);
        }
      } else {
        setActiveTimelineCycle(cycleState.index);
      }
      return;
    }
  }
}

/**
 * Finalize all timeline cycles
 */
export function finalizeTimeline() {
  if (!intentionTimelineState) return;
  intentionTimelineState.cycles.forEach(cycle => {
    if (cycle.totalMoves === 0) {
      cycle.timeElement.textContent =
        cycle.timeElement.textContent === '--:--' && plannerClockStart
          ? formatPlannerDuration(Date.now() - plannerClockStart)
          : cycle.timeElement.textContent;
      return;
    }

    if (cycle.processedMoves >= cycle.totalMoves) {
      if (!cycle.visual.completed) {
        completeTimelineCycle(cycle);
      }
    }
  });
}

export function getIntentionTimelineSnapshot() {
  if (!lastRenderedLog || !Array.isArray(lastRenderedLog)) {
    return null;
  }

  let durations = null;
  if (intentionTimelineState && Array.isArray(intentionTimelineState.cycles)) {
    durations = intentionTimelineState.cycles.map(cycle => {
      const text = cycle?.timeElement?.textContent;
      return typeof text === 'string' && text.trim().length > 0 ? text : '--:--';
    });
  } else {
    durations = lastRenderedLog.map(() => '--:--');
  }

  const clockDisplay = (() => {
    const clockElem = DOM.plannerClock();
    return clockElem && typeof clockElem.textContent === 'string'
      ? clockElem.textContent
      : '--:--';
  })();

  return {
    log: lastRenderedLog,
    agentCount: lastRenderedAgentCount,
    options: lastRenderedOptions,
    durations,
    clockDisplay
  };
}

export function restoreTimelineFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    resetIntentionTimeline();
    return;
  }

  const { log, agentCount = 0, options = {} } = snapshot;
  if (!Array.isArray(log) || log.length === 0) {
    resetIntentionTimeline(options.emptyMessage);
    return;
  }

  const { durations = null, clockDisplay } = snapshot;
  const renderOptions = durations && Array.isArray(durations) && durations.length > 0
    ? { ...options, prefillDurations: durations }
    : options;

  renderIntentionTimeline(log, agentCount, renderOptions);
  if (typeof clockDisplay === 'string' && clockDisplay.trim().length > 0) {
    updatePlannerClockDisplay(clockDisplay);
  }
}
