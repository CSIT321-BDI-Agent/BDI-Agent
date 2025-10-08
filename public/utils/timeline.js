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

// Timeline state
let intentionTimelineState = null;
let plannerClockInterval = null;
let plannerClockStart = null;

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

  const emptyMessage = options.emptyMessage || 'Planner has not produced any cycles yet.';

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
    header.className = 'flex items-center justify-between gap-3';

    const title = document.createElement('span');
    title.className = 'text-sm font-semibold text-brand-dark';
    title.textContent = `Cycle ${idx + 1}`;

    const time = document.createElement('span');
    time.className = 'text-xs font-mono text-brand-dark/60';
    time.textContent = '--:--';

    header.appendChild(title);
    header.appendChild(time);
    entry.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'mt-3 flex flex-col gap-2';

    const moves = Array.isArray(cycle?.moves) ? cycle.moves : [];
    const moveStates = [];
    let totalActionMoves = 0;

    moves.forEach((move, moveIdx) => {
      const item = document.createElement('li');
      item.className = MOVE_BASE_CLASS;

      let description = 'No planner actions recorded.';
      let moveState = 'informational';

      if (move && move.block) {
        totalActionMoves += 1;
        const actor = move.actor || `Agent ${moveIdx + 1}`;
        const destination = move.to || 'Table';
        const reason = move.reason || 'move';
        description = `${actor}: ${move.block} -> ${destination} (${reason})`;
        moveState = 'pending';
      } else if (move && move.skipped) {
        const actor = move.actor || `Agent ${moveIdx + 1}`;
        const reason = move.reason || 'no action';
        description = `${actor}: skipped (${reason})`;
        moveState = 'skip';
      }

      item.textContent = description;
      setMoveVisualState(item, moveState);

      list.appendChild(item);

      moveStates.push({
        meta: move,
        element: item,
        completed: moveState !== 'pending',
        isAction: Boolean(move && move.block)
      });
    });

    entry.appendChild(list);
    container.appendChild(entry);

    const cycleState = {
      index: idx,
      entryElement: entry,
      timeElement: time,
      moveStates,
      totalMoves: totalActionMoves,
      processedMoves: 0,
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
    state.cycles.push(cycleState);
  });

  intentionTimelineState = state;
  const firstActionIndex = state.cycles.findIndex(cycle => cycle.totalMoves > 0);
  if (firstActionIndex >= 0) {
    setActiveTimelineCycle(firstActionIndex);
  }
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

    const matcher = cycleState.moveStates.find(ms => ms.isAction && !ms.completed);

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
