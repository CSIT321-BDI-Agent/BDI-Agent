import { DOM } from './constants.js';
import { incrementStep } from './stats.js';
import { formatPlannerDuration } from './helpers.js';

const ENTRY_BASE_CLASS = 'border border-slate-200 bg-white/95 p-4 shadow-card transition-all duration-200';
const EMPTY_PLACEHOLDER_CLASS = 'border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-medium text-slate-500';
const ENTRY_STATE_CLASSES = {
  pending: ['opacity-80'],
  active: ['border-brand-primary', 'bg-brand-primary/15', 'shadow-lg', 'ring-2', 'ring-brand-primary/30', 'opacity-100'],
  completed: ['border-emerald-300', 'bg-emerald-50', 'opacity-100']
};
const STEP_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60';
const SUMMARY_CLASS = 'mt-1 text-sm font-semibold text-brand-dark';
const META_CLASS = 'mt-2 text-xs text-brand-dark/70';
const BADGE_BASE_CLASS = 'inline-flex items-center gap-2 rounded border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] shadow-sm';
const AGENT_A_BADGE_CLASS = `${BADGE_BASE_CLASS} border-teal-500/50 bg-teal-500/20 text-teal-800`;
const AGENT_A_DOT_CLASS = 'h-2 w-2 rounded-full bg-teal-600 shadow-[0_0_0_1px_rgba(20,184,166,0.35)]';
const AGENT_B_BADGE_CLASS = `${BADGE_BASE_CLASS} border-purple-500/50 bg-purple-500/20 text-purple-800`;
const AGENT_B_DOT_CLASS = 'h-2 w-2 rounded-full bg-purple-600 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]';
const DEFAULT_BADGE_CLASS = `${BADGE_BASE_CLASS} border-slate-300 bg-slate-100 text-brand-dark`;
const DEFAULT_DOT_CLASS = 'h-2 w-2 rounded-full bg-slate-400 shadow-[0_0_0_1px_rgba(148,163,184,0.35)]';
const TIME_LABEL_CLASS = 'text-xs font-mono font-semibold text-brand-dark/40';
const TIME_ACTIVE_CLASS = 'text-brand-primary';
const TIME_COMPLETED_CLASS = 'text-emerald-600';

const timelineState = {
  entries: [],
  container: null,
  lastRenderedLog: null,
  lastRenderedPlan: null,
  lastRenderedAgentCount: 0,
  lastRenderedOptions: {}
};

let plannerClockStart = null;
let plannerClockInterval = null;
let lastKnownEmptyMessage = 'No planner data yet.';

function ensureContainer() {
  const container = DOM.intentionTimeline();
  if (!container) {
    console.warn('[Timeline] Unable to locate intention timeline container.');
  }
  return container;
}

function clearTimeline(message = lastKnownEmptyMessage) {
  const container = ensureContainer();
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (message) {
    const placeholder = document.createElement('div');
    placeholder.className = EMPTY_PLACEHOLDER_CLASS;
    placeholder.textContent = message;
    container.appendChild(placeholder);
  }
  timelineState.entries = [];
  timelineState.container = container;
}

function humanizeLabel(input) {
  if (!input || typeof input !== 'string') return '';
  const cleaned = input.replace(/[\s_\-]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function normalizeActor(actor, fallbackIndex = 0) {
  if (typeof actor === 'string' && actor.trim().length > 0) {
    return actor.trim();
  }
  return `Agent-${String.fromCharCode(65 + fallbackIndex)}`;
}

function formatDestination(destination) {
  if (!destination) return 'Table';
  const value = String(destination).trim();
  if (!value) return 'Table';
  if (value.toLowerCase() === 'table') return 'Table';
  return value;
}

function clonePlanMoves(plan) {
  if (!Array.isArray(plan)) return [];
  return plan
    .map((group) => {
      if (!group || typeof group !== 'object') return null;
      const cloned = { ...group };
      if (Array.isArray(group.moves)) {
        cloned.moves = group.moves
          .map((move) => (move && typeof move === 'object' ? { ...move } : null))
          .filter(Boolean);
      }
      return cloned;
    })
    .filter(Boolean);
}

function cloneLog(log) {
  if (!Array.isArray(log)) return [];
  return log.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const clone = { ...entry };
    if (Array.isArray(entry.moves)) {
      clone.moves = entry.moves.map((move) => (move && typeof move === 'object' ? { ...move } : move));
    }
    if (Array.isArray(entry.resultingStacks)) {
      clone.resultingStacks = entry.resultingStacks.map((stack) => (Array.isArray(stack) ? [...stack] : stack));
    }
    if (entry.beliefs && typeof entry.beliefs === 'object') {
      clone.beliefs = {
        pendingRelation: entry.beliefs.pendingRelation ? { ...entry.beliefs.pendingRelation } : null,
        clearBlocks: Array.isArray(entry.beliefs.clearBlocks) ? [...entry.beliefs.clearBlocks] : [],
        onMap: entry.beliefs.onMap ? { ...entry.beliefs.onMap } : {}
      };
    }
    return clone;
  });
}

function formatDurationLabel(durationMs) {
  return Number.isFinite(durationMs) && durationMs >= 0
    ? formatPlannerDuration(durationMs)
    : '--:--.--';
}

function setTimeDisplay(entry, text, modifierClass = '') {
  if (!entry?.timeElement) {
    return;
  }
  const modifier = modifierClass ? ` ${modifierClass}` : '';
  entry.timeElement.className = `${TIME_LABEL_CLASS}${modifier}`;
  entry.timeElement.textContent = text;
}

function getBaselineDuration(entry) {
  if (!entry || !Array.isArray(timelineState.entries)) {
    return 0;
  }
  const previous = timelineState.entries[entry.index - 1];
  if (!previous) {
    return 0;
  }
  return Number.isFinite(previous.cumulativeMs) ? previous.cumulativeMs : 0;
}

function derivePlanFromLog(intentionLog) {
  if (!Array.isArray(intentionLog)) return [];
  return intentionLog
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const moves = Array.isArray(entry.moves) ? entry.moves.filter((move) => move && move.block) : [];
      if (!moves.length) return null;
      return {
        moves: moves.map((move) => (move && typeof move === 'object' ? { ...move } : move)),
        deliberation: entry.deliberation
      };
    })
    .filter(Boolean);
}

function normalizePlan(planMoves, intentionLog) {
  const normalizeGroup = (group) => {
    if (!group) return null;
    const rawMoves = Array.isArray(group.moves)
      ? group.moves
      : group.block
        ? [group]
        : [];
    const moves = rawMoves
      .map((move) => (move && typeof move === 'object' ? { ...move } : null))
      .filter((move) => move && typeof move.block === 'string');
    if (!moves.length) return null;
    return { ...group, moves };
  };

  const hasPlanMoves = Array.isArray(planMoves) && planMoves.length > 0;
  if (!hasPlanMoves) {
    return derivePlanFromLog(intentionLog)
      .map(normalizeGroup)
      .filter(Boolean);
  }

  const normalizedPlan = planMoves
    .map(normalizeGroup)
    .filter(Boolean);

  if (!Array.isArray(intentionLog) || !intentionLog.length) {
    return normalizedPlan;
  }

  const logDerived = derivePlanFromLog(intentionLog)
    .map(normalizeGroup)
    .filter(Boolean);

  const hasManual = logDerived.some((group) => group.moves.some((move) => move.manual));
  if (!hasManual) {
    return normalizedPlan;
  }

  const planQueue = [...normalizedPlan];
  const merged = [];

  logDerived.forEach((group) => {
    const isManual = group.moves.some((move) => move.manual);
    if (isManual) {
      merged.push(group);
    } else if (planQueue.length) {
      merged.push(planQueue.shift());
    } else {
      merged.push(group);
    }
  });

  while (planQueue.length) {
    merged.push(planQueue.shift());
  }

  return merged;
}

function findLogContext(intentionLog, block, destination) {
  if (!Array.isArray(intentionLog)) return '';
  for (const entry of intentionLog) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.moves)) continue;
    const match = entry.moves.find((move) => move && move.block === block && (!destination || formatDestination(move.to) === destination));
    if (!match) continue;
    const reason = match.reason || match.stepDescription || (entry.deliberation && entry.deliberation.reason);
    if (reason) {
      return humanizeLabel(reason);
    }
  }
  return '';
}

function buildEntries(planGroups, intentionLog) {
  const entries = [];
  planGroups.forEach((group, groupIndex) => {
    const moves = Array.isArray(group.moves) ? group.moves : [];
    const groupSize = moves.length;
    const stepNumber = groupIndex + 1;
    moves.forEach((move, moveIndex) => {
      const isManual = Boolean(move?.manual);
      const actor = normalizeActor(move.actor, moveIndex);
      const destination = formatDestination(move.to);
      const reasonSource = move.stepDescription || move.reason || group.reason || '';
      const reason = humanizeLabel(reasonSource);
      const manualDetail = typeof move.detail === 'string' ? move.detail.trim() : '';
      const context = isManual
        ? (manualDetail || null)
        : findLogContext(intentionLog, move.block, destination);
      const summary = (typeof move.summary === 'string' && move.summary.trim().length)
        ? move.summary.trim()
        : `Move ${move.block} → ${destination}`;
      const stepLabel = typeof move.stepLabel === 'string' && move.stepLabel.trim().length
        ? move.stepLabel.trim()
        : null;
      const initialStatus = isManual ? 'completed' : 'pending';

      entries.push({
        id: `step-${stepNumber}-${moveIndex}-${move.block}-${actor}`,
        index: entries.length,
        stepNumber,
        actor,
        block: move.block,
        to: destination,
        summary,
        reason: reason || null,
        context: context && context !== reason ? context : null,
        detail: isManual && manualDetail ? manualDetail : null,
        concurrent: groupSize > 1,
        groupSize,
        status: 'pending',
        initialStatus,
        manual: isManual,
        manualType: isManual && typeof move.manualType === 'string' ? move.manualType : null,
        stepLabel,
        started: false,
        completed: false,
        element: null,
        timeElement: null,
        startedAt: null,
        durationMs: isManual && Number.isFinite(move.durationMs) ? move.durationMs : (isManual ? 0 : null),
        cumulativeMs: null
      });
    });
  });
  entries.forEach((entry, idx) => {
    entry.index = idx;
  });
  return entries;
}

function createAgentBadge(actor) {
  const badge = document.createElement('span');
  const indicator = document.createElement('span');
  const label = document.createElement('span');
  const normalized = actor.toLowerCase();

  if (normalized.includes('agent-b')) {
    badge.className = AGENT_B_BADGE_CLASS;
    indicator.className = AGENT_B_DOT_CLASS;
  } else if (normalized.includes('agent-a')) {
    badge.className = AGENT_A_BADGE_CLASS;
    indicator.className = AGENT_A_DOT_CLASS;
  } else {
    badge.className = DEFAULT_BADGE_CLASS;
    indicator.className = DEFAULT_DOT_CLASS;
  }

  indicator.setAttribute('aria-hidden', 'true');
  label.textContent = actor;

  badge.dataset.role = 'timeline-agent';
  badge.dataset.agentType = normalized.includes('agent-b') ? 'Agent-B' : normalized.includes('agent-a') ? 'Agent-A' : actor;
  badge.appendChild(indicator);
  badge.appendChild(label);
  return badge;
}

function createEntryElement(entry) {
  const card = document.createElement('article');
  card.className = ENTRY_BASE_CLASS;
  card.dataset.entryId = entry.id;
  card.dataset.stepNumber = String(entry.stepNumber);
  card.dataset.actor = entry.actor;
  card.dataset.block = entry.block;
  card.dataset.status = entry.status;
  ENTRY_STATE_CLASSES.pending.forEach((cls) => card.classList.add(cls));

  const header = document.createElement('div');
  header.className = 'flex items-start gap-3';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'flex flex-1 flex-col';

  const stepLabel = document.createElement('span');
  stepLabel.className = STEP_LABEL_CLASS;
  const defaultLabel = entry.concurrent ? `Step ${entry.stepNumber} · Concurrent` : `Step ${entry.stepNumber}`;
  stepLabel.textContent = entry.stepLabel || defaultLabel;

  const summary = document.createElement('span');
  summary.className = SUMMARY_CLASS;
  summary.textContent = entry.summary;

  titleGroup.appendChild(stepLabel);
  titleGroup.appendChild(summary);

  const rightColumn = document.createElement('div');
  rightColumn.className = 'ml-auto flex min-h-[56px] flex-col items-end gap-2';

  const timeDisplay = document.createElement('span');
  timeDisplay.className = TIME_LABEL_CLASS;
  timeDisplay.textContent = '--:--.--';

  if (entry.manual) {
    card.dataset.entryType = 'manual';
    card.classList.add('border-dashed', 'border-brand-primary/40', 'bg-brand-primary/10');
  }

  const badgeGroup = document.createElement('div');
  badgeGroup.className = 'mt-auto flex items-center gap-2';
  badgeGroup.appendChild(createAgentBadge(entry.actor));

  header.appendChild(titleGroup);
  rightColumn.appendChild(timeDisplay);
  rightColumn.appendChild(badgeGroup);
  header.appendChild(rightColumn);
  card.appendChild(header);

  const details = [];
  if (entry.reason) details.push(entry.reason);
  if (entry.context && entry.context !== entry.reason) details.push(entry.context);
  if (entry.detail && entry.detail !== entry.context) details.push(entry.detail);
  if (details.length) {
    const meta = document.createElement('p');
    meta.className = META_CLASS;
    meta.textContent = details.join(' · ');
    card.appendChild(meta);
  }

  entry.timeElement = timeDisplay;

  return card;
}

function setEntryStatus(entry, status, { increment = false } = {}) {
  if (!entry || !entry.element) return;
  const baselineMs = getBaselineDuration(entry);

  if (entry.status === status) {
    if (status === 'completed') {
      const total = Number.isFinite(entry.cumulativeMs) ? entry.cumulativeMs : baselineMs;
      entry.cumulativeMs = total;
      setTimeDisplay(entry, formatDurationLabel(total), TIME_COMPLETED_CLASS);
    } else if (status === 'active') {
      const runningTotal = baselineMs + (entry.startedAt != null ? Math.max(0, Date.now() - entry.startedAt) : 0);
      entry.cumulativeMs = baselineMs;
      setTimeDisplay(entry, formatDurationLabel(runningTotal), TIME_ACTIVE_CLASS);
    } else {
      entry.cumulativeMs = baselineMs;
      setTimeDisplay(entry, formatDurationLabel(baselineMs));
    }
    return;
  }

  Object.values(ENTRY_STATE_CLASSES).forEach((classes) => {
    classes.forEach((cls) => entry.element.classList.remove(cls));
  });

  const classesToApply = ENTRY_STATE_CLASSES[status] || ENTRY_STATE_CLASSES.pending;
  classesToApply.forEach((cls) => entry.element.classList.add(cls));

  entry.status = status;
  entry.element.dataset.status = status;

  if (status === 'active') {
    if (entry.startedAt == null) {
      entry.startedAt = Date.now();
    }
    entry.started = true;
    entry.completed = false;
    entry.durationMs = null;
    entry.cumulativeMs = baselineMs;
    setTimeDisplay(entry, formatDurationLabel(entry.cumulativeMs), TIME_ACTIVE_CLASS);
  } else if (status === 'completed') {
    let stepDuration = Number.isFinite(entry.durationMs) ? entry.durationMs : null;
    if (stepDuration == null) {
      stepDuration = entry.startedAt != null ? Math.max(0, Date.now() - entry.startedAt) : 0;
    }
    entry.durationMs = stepDuration;
    const cumulative = baselineMs + stepDuration;
    entry.cumulativeMs = cumulative;
    entry.startedAt = null;
    entry.started = true;
    entry.completed = true;
    setTimeDisplay(entry, formatDurationLabel(entry.cumulativeMs), TIME_COMPLETED_CLASS);
    if (increment) {
      incrementStep();
    }
  } else {
    entry.startedAt = null;
    entry.durationMs = null;
    entry.cumulativeMs = baselineMs;
    entry.started = false;
    entry.completed = false;
    setTimeDisplay(entry, formatDurationLabel(entry.cumulativeMs));
  }
}

function findEntryForStep(step) {
  if (!step || typeof step !== 'object') return null;
  const { block } = step;
  if (!block) return null;
  const actor = typeof step.actor === 'string' && step.actor.trim().length > 0 ? step.actor.trim() : null;
  return timelineState.entries.find((entry) => {
    if (entry.completed) return false;
    if (entry.block !== block) return false;
    if (actor && entry.actor !== actor) return false;
    return true;
  });
}

function applyEntryStatusSnapshot(entryStatusList) {
  if (!Array.isArray(entryStatusList) || !entryStatusList.length) {
    return;
  }

  entryStatusList.forEach((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    const target = timelineState.entries.find((entry) => {
      if (entry.stepNumber !== snapshot.stepNumber) return false;
      if (entry.block !== snapshot.block) return false;
      if (snapshot.actor && entry.actor !== snapshot.actor) return false;
      return true;
    });

    if (!target) return;

    const status = snapshot.status || 'pending';
    target.durationMs = Number.isFinite(snapshot.durationMs) && snapshot.durationMs >= 0 ? snapshot.durationMs : null;
    target.cumulativeMs = Number.isFinite(snapshot.cumulativeMs) && snapshot.cumulativeMs >= 0 ? snapshot.cumulativeMs : null;
    target.startedAt = null;
    target.started = status === 'active' || status === 'completed';
    target.completed = status === 'completed';
    setEntryStatus(target, status, { increment: false });
  });
}

export function updatePlannerClockDisplay(text) {
  const elem = DOM.plannerClock();
  if (!elem) return;
  elem.textContent = typeof text === 'string' ? text : '--:--';
}

export function stopPlannerClock(finalize = false) {
  if (plannerClockInterval) {
    clearInterval(plannerClockInterval);
    plannerClockInterval = null;
  }

  const clockElem = DOM.plannerClock();
  if (!clockElem) {
    plannerClockStart = null;
    return;
  }

  if (plannerClockStart && finalize) {
    const elapsed = Date.now() - plannerClockStart;
    clockElem.textContent = formatPlannerDuration(elapsed);
  } else if (!finalize) {
    clockElem.textContent = '--:--';
  }

  plannerClockStart = null;
}

export function startPlannerClock() {
  stopPlannerClock(false);
  const clockElem = DOM.plannerClock();
  if (!clockElem) return;

  plannerClockStart = Date.now();
  clockElem.textContent = '00:00.00';

  plannerClockInterval = window.setInterval(() => {
    if (!plannerClockStart) return;
    const elapsed = Date.now() - plannerClockStart;
    clockElem.textContent = formatPlannerDuration(elapsed);
  }, 125);
}

export function resetIntentionTimeline(message = 'No planner data yet.') {
  lastKnownEmptyMessage = message;
  clearTimeline(message);
  timelineState.lastRenderedLog = null;
  timelineState.lastRenderedPlan = null;
  timelineState.lastRenderedAgentCount = 0;
  timelineState.lastRenderedOptions = { emptyMessage: message };
}

export function renderIntentionTimeline(intentionLog = [], agentCount = 0, options = {}) {
  const container = ensureContainer();
  if (!container) return;

  const {
    planMoves = [],
    emptyMessage = 'No planner data yet.',
    entryStatus = null
  } = options;

  lastKnownEmptyMessage = emptyMessage;

  const clonedPlan = clonePlanMoves(planMoves);
  const normalizedPlan = normalizePlan(clonedPlan, intentionLog);
  const entries = buildEntries(normalizedPlan, intentionLog);

  container.innerHTML = '';

  if (!entries.length) {
    clearTimeline(emptyMessage);
  } else {
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      entry.element = createEntryElement(entry);
      fragment.appendChild(entry.element);
    });
    container.appendChild(fragment);
    timelineState.entries = entries;
    timelineState.container = container;
    entries.forEach((entry) => {
      const targetStatus = entry.initialStatus || entry.status;
      setEntryStatus(entry, targetStatus, { increment: false });
    });
    applyEntryStatusSnapshot(entryStatus);
  }

  timelineState.lastRenderedLog = cloneLog(intentionLog);
  timelineState.lastRenderedPlan = clonePlanMoves(normalizedPlan);
  timelineState.lastRenderedAgentCount = agentCount;
  timelineState.lastRenderedOptions = { emptyMessage };
}

export function markTimelineStep(step) {
  if (!timelineState.entries.length) return;

  const entry = findEntryForStep(step);
  if (!entry) return;

  if (entry.status !== 'active') {
    setEntryStatus(entry, 'active');
  }

  if (step && step.type === 'DROP' && !entry.completed) {
    setEntryStatus(entry, 'completed', { increment: true });
    for (let idx = entry.index + 1; idx < timelineState.entries.length; idx += 1) {
      const follower = timelineState.entries[idx];
      if (!follower) continue;
      if (follower.status === 'pending' || follower.status === 'active') {
        setEntryStatus(follower, follower.status, { increment: false });
      }
    }
  }
}

export function finalizeTimeline() {
  timelineState.entries.forEach((entry) => {
    if (!entry.completed) {
      entry.completed = true;
      entry.started = true;
      setEntryStatus(entry, 'completed', { increment: false });
    }
  });
}

export function getIntentionTimelineSnapshot() {
  if (!timelineState.lastRenderedLog) {
    return null;
  }

  const clockElem = DOM.plannerClock();
  const clockDisplay = clockElem && typeof clockElem.textContent === 'string'
    ? clockElem.textContent
    : '--:--';

  const entryStatus = timelineState.entries.map((entry) => ({
    stepNumber: entry.stepNumber,
    block: entry.block,
    actor: entry.actor,
    status: entry.status,
    durationMs: entry.durationMs ?? null,
    cumulativeMs: entry.cumulativeMs ?? null
  }));

  return {
    log: cloneLog(timelineState.lastRenderedLog),
    plan: clonePlanMoves(timelineState.lastRenderedPlan || []),
    agentCount: timelineState.lastRenderedAgentCount,
    options: { ...timelineState.lastRenderedOptions },
    entryStatus,
    clockDisplay
  };
}

export function restoreTimelineFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    resetIntentionTimeline(lastKnownEmptyMessage);
    return;
  }

  const log = Array.isArray(snapshot.log) ? snapshot.log : [];
  const plan = Array.isArray(snapshot.plan) ? snapshot.plan : [];
  const agentCount = Number.isFinite(snapshot.agentCount) ? snapshot.agentCount : 0;
  const options = snapshot.options && typeof snapshot.options === 'object'
    ? { ...snapshot.options }
    : {};
  const entryStatus = Array.isArray(snapshot.entryStatus) ? snapshot.entryStatus : null;

  renderIntentionTimeline(log, agentCount, {
    ...options,
    planMoves: plan,
    entryStatus
  });

  if (typeof snapshot.clockDisplay === 'string' && snapshot.clockDisplay.trim().length > 0) {
    updatePlannerClockDisplay(snapshot.clockDisplay);
  }
}
