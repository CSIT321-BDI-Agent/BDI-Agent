/**
 * Timeline Management System
 * 
 * Manages the planner timeline visualization including:
 * - Rendering intention logs
 * - Tracking cycle progress
 * - Planner clock display
 */

import { formatPlannerDuration, formatBeliefSnapshot } from './helpers.js';
import { DOM } from './constants.js';
import { incrementStep } from './stats.js';

// Timeline state
let intentionTimelineState = null;
let plannerClockInterval = null;
let plannerClockStart = null;

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
  empty.className = 'timeline-empty';
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
    empty.className = 'timeline-empty';
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
    entry.className = 'timeline-entry pending';
    entry.dataset.cycleIndex = String(idx);

    const header = document.createElement('div');
    header.className = 'timeline-header';

    const title = document.createElement('span');
    title.className = 'timeline-cycle';
    title.textContent = `Cycle ${idx + 1}`;

    const time = document.createElement('span');
    time.className = 'timeline-time';
    time.textContent = '--:--';

    header.appendChild(title);
    header.appendChild(time);
    entry.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'timeline-moves';

    const moves = Array.isArray(cycle?.moves) ? cycle.moves : [];
    const moveStates = [];
    let totalActionMoves = 0;

    moves.forEach((move, moveIdx) => {
      const item = document.createElement('li');
      item.className = 'timeline-move pending';
      let description = '';
      if (move && move.block) {
        totalActionMoves += 1;
        const actor = move.actor || `Agent ${moveIdx + 1}`;
        const destination = move.to || 'Table';
        const reason = move.reason || 'move';
        description = `${actor}: ${move.block} → ${destination} (${reason})`;
      } else if (move && move.skipped) {
        const actor = move.actor || `Agent ${moveIdx + 1}`;
        const reason = move.reason || 'no action';
        item.classList.add('skip');
        item.classList.remove('pending');
        description = `${actor}: skipped (${reason})`;
      } else {
        item.classList.add('informational');
        item.classList.remove('pending');
        description = '—';
      }

      item.textContent = description;
      list.appendChild(item);

      moveStates.push({
        meta: move,
        element: item,
        completed: Boolean(move && move.skipped && !move.block),
        isAction: Boolean(move && move.block)
      });
    });

    entry.appendChild(list);
    container.appendChild(entry);

    state.cycles.push({
      index: idx,
      entryElement: entry,
      timeElement: time,
      moveStates,
      totalMoves: totalActionMoves,
      processedMoves: 0
    });
  });

  state.cycles.forEach(cycleState => {
    if (cycleState.totalMoves === 0) {
      cycleState.entryElement.classList.add('no-actions', 'completed');
      cycleState.entryElement.classList.remove('pending');
    }
  });

  intentionTimelineState = state;
  setActiveTimelineCycle(state.cycles.findIndex(cycle => cycle.totalMoves > 0));
}

/**
 * Set active timeline cycle
 * @param {number} index - Cycle index
 */
function setActiveTimelineCycle(index) {
  if (!intentionTimelineState || !Array.isArray(intentionTimelineState.cycles)) return;
  intentionTimelineState.cycles.forEach(cycle => {
    cycle.entryElement.classList.remove('active');
  });
  if (index == null || index < 0) return;
  const target = intentionTimelineState.cycles[index];
  if (target && target.totalMoves > 0) {
    target.entryElement.classList.add('active');
  }
}

/**
 * Complete a timeline cycle
 * @param {Object} cycleState - Cycle state object
 */
function completeTimelineCycle(cycleState) {
  if (!cycleState) return;
  cycleState.entryElement.classList.remove('pending');
  cycleState.entryElement.classList.remove('active');
  cycleState.entryElement.classList.add('completed');
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
  
  // Increment step counter in stats
  incrementStep();
  
  // Find the next pending cycle to mark as complete
  for (const cycleState of intentionTimelineState.cycles) {
    if (cycleState.totalMoves === 0) continue;
    if (cycleState.processedMoves >= cycleState.totalMoves) continue;

    // Find any pending move state in this cycle
    const matcher = cycleState.moveStates.find(ms => 
      ms.isAction && !ms.completed
    );
    
    if (matcher) {
      matcher.completed = true;
      matcher.element.classList.remove('pending');
      matcher.element.classList.add('done');
      cycleState.processedMoves += 1;

      if (cycleState.processedMoves >= cycleState.totalMoves) {
        completeTimelineCycle(cycleState);
        const nextIndex = cycleState.index + 1;
        const nextActionIndex = intentionTimelineState.cycles.findIndex((c, idx) => 
          idx >= nextIndex && c.totalMoves > 0 && c.processedMoves < c.totalMoves
        );
        setActiveTimelineCycle(nextActionIndex);
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
      cycle.timeElement.textContent = cycle.timeElement.textContent === '--:--' && plannerClockStart
        ? formatPlannerDuration(Date.now() - plannerClockStart)
        : cycle.timeElement.textContent;
      return;
    }
    if (cycle.processedMoves >= cycle.totalMoves) {
      if (!cycle.entryElement.classList.contains('completed')) {
        completeTimelineCycle(cycle);
      }
    }
  });
}
