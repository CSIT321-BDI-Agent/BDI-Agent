/**
 * Intention Timeline - Complete Rewrite
 * 
 * Architecture:
 * - Global clock tracks total elapsed time from simulation start to finish
 * - Each card = one agent move = one step
 * - Concurrent moves share the same step number, shown on separate cards
 * - Active card highlighted with green background
 * - Completed cards snapshot the elapsed time when they finished
 * - Manual edits: remove uncompleted cards, add manual card, add new plan
 */

import { DOM } from './constants.js';
import { incrementStep } from './stats.js';
import { formatPlannerDuration } from './helpers.js';

// Card styling constants
const CARD_BASE = 'border border-slate-200 bg-white/95 p-4 shadow-card transition-all duration-200';
const CARD_PENDING = 'opacity-80';
const CARD_ACTIVE = 'border-emerald-500 bg-emerald-100 shadow-lg ring-2 ring-emerald-500/30';
const CARD_COMPLETED = 'border-emerald-300 bg-emerald-50';
const CARD_MANUAL = 'border-dashed border-brand-primary/40 bg-brand-primary/10';

const STEP_LABEL = 'text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60';
const MOVE_SUMMARY = 'mt-1 text-sm font-semibold text-brand-dark';
const MOVE_META = 'mt-2 text-xs text-brand-dark/70';
const TIME_DISPLAY = 'text-xs font-mono font-semibold text-brand-dark/40';
const TIME_ACTIVE = 'text-emerald-600';

const BADGE_BASE = 'inline-flex items-center gap-2 rounded border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] shadow-sm';
const BADGE_AGENT_A = `${BADGE_BASE} border-teal-500/50 bg-teal-500/20 text-teal-800`;
const BADGE_AGENT_B = `${BADGE_BASE} border-purple-500/50 bg-purple-500/20 text-purple-800`;
const BADGE_USER = `${BADGE_BASE} border-slate-300 bg-slate-100 text-brand-dark`;
const DOT_AGENT_A = 'h-2 w-2 rounded-full bg-teal-600';
const DOT_AGENT_B = 'h-2 w-2 rounded-full bg-purple-600';
const DOT_USER = 'h-2 w-2 rounded-full bg-slate-400';

// Timeline state
const timeline = {
  cards: [],           // Array of card objects
  container: null,     // DOM container
  clockStart: null,    // When simulation started
  clockInterval: null  // Update interval
};

/**
 * Start the global elapsed timer
 */
export function startPlannerClock() {
  stopPlannerClock();
  
  timeline.clockStart = Date.now();
  updateClockDisplay('00:00.00');
  
  timeline.clockInterval = setInterval(() => {
    if (!timeline.clockStart) return;
    const elapsed = Date.now() - timeline.clockStart;
    updateClockDisplay(formatPlannerDuration(elapsed));
    
    // Update active card time
    const activeCard = timeline.cards.find(c => c.status === 'active');
    if (activeCard && activeCard.timeElement) {
      activeCard.timeElement.textContent = formatPlannerDuration(elapsed);
    }
  }, 125);
}

/**
 * Stop the global elapsed timer
 */
export function stopPlannerClock(finalize = false) {
  if (timeline.clockInterval) {
    clearInterval(timeline.clockInterval);
    timeline.clockInterval = null;
  }
  
  if (finalize && timeline.clockStart) {
    const elapsed = Date.now() - timeline.clockStart;
    updateClockDisplay(formatPlannerDuration(elapsed));
  } else if (!finalize) {
    updateClockDisplay('--:--');
  }
  
  if (finalize) {
    timeline.clockStart = null;
  }
}

/**
 * Update clock display text
 */
export function updatePlannerClockDisplay(text) {
  updateClockDisplay(text);
}

function updateClockDisplay(text) {
  const clockElem = DOM.plannerClock();
  if (clockElem) {
    clockElem.textContent = text || '--:--';
  }
}

/**
 * Get current elapsed time in milliseconds
 */
function getElapsedTime() {
  if (!timeline.clockStart) return 0;
  return Date.now() - timeline.clockStart;
}

/**
 * Reset timeline to empty state
 */
export function resetIntentionTimeline(message = 'No planner data yet.') {
  const container = DOM.intentionTimeline();
  if (!container) return;
  
  container.innerHTML = '';
  timeline.cards = [];
  timeline.container = container;
  
  if (message) {
    const placeholder = document.createElement('div');
    placeholder.className = 'border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-medium text-slate-500';
    placeholder.textContent = message;
    container.appendChild(placeholder);
  }
  
  stopPlannerClock(false);
}

/**
 * Create agent badge
 */
function createAgentBadge(actor) {
  const badge = document.createElement('span');
  const dot = document.createElement('span');
  const label = document.createElement('span');
  
  const actorLower = String(actor).toLowerCase();
  
  if (actorLower.includes('agent-b') || actorLower === 'agent b') {
    badge.className = BADGE_AGENT_B;
    dot.className = DOT_AGENT_B;
  } else if (actorLower.includes('agent-a') || actorLower === 'agent a') {
    badge.className = BADGE_AGENT_A;
    dot.className = DOT_AGENT_A;
  } else {
    badge.className = BADGE_USER;
    dot.className = DOT_USER;
  }
  
  label.textContent = actor;
  badge.appendChild(dot);
  badge.appendChild(label);
  
  return badge;
}

/**
 * Create a timeline card element
 */
function createCard(cardData) {
  const card = document.createElement('article');
  card.className = CARD_BASE;
  if (cardData.isManual) {
    card.classList.add(...CARD_MANUAL.split(' '));
  }
  card.dataset.cardId = cardData.id;
  card.dataset.status = cardData.status;
  
  // Header
  const header = document.createElement('div');
  header.className = 'flex items-start gap-3';
  
  // Left: Title group
  const titleGroup = document.createElement('div');
  titleGroup.className = 'flex flex-1 flex-col';
  
  const stepLabel = document.createElement('span');
  stepLabel.className = STEP_LABEL;
  stepLabel.textContent = cardData.stepLabel;
  
  const summary = document.createElement('span');
  summary.className = MOVE_SUMMARY;
  summary.textContent = cardData.summary;
  
  titleGroup.appendChild(stepLabel);
  titleGroup.appendChild(summary);
  
  // Right: Time + Badge
  const rightColumn = document.createElement('div');
  rightColumn.className = 'ml-auto flex min-h-[56px] flex-col items-end gap-2';
  
  const timeDisplay = document.createElement('span');
  timeDisplay.className = TIME_DISPLAY;
  timeDisplay.textContent = '--:--';
  
  const badgeGroup = document.createElement('div');
  badgeGroup.className = 'mt-auto flex items-center gap-2';
  badgeGroup.appendChild(createAgentBadge(cardData.actor));
  
  rightColumn.appendChild(timeDisplay);
  rightColumn.appendChild(badgeGroup);
  
  header.appendChild(titleGroup);
  header.appendChild(rightColumn);
  card.appendChild(header);
  
  // Meta details
  if (cardData.details) {
    const meta = document.createElement('p');
    meta.className = MOVE_META;
    meta.textContent = cardData.details;
    card.appendChild(meta);
  }
  
  cardData.element = card;
  cardData.timeElement = timeDisplay;
  
  return card;
}

/**
 * Update card visual state
 */
function setCardStatus(card, status) {
  if (!card || !card.element) return;
  
  // Remove all status classes
  card.element.classList.remove(...CARD_PENDING.split(' '));
  card.element.classList.remove(...CARD_ACTIVE.split(' '));
  card.element.classList.remove(...CARD_COMPLETED.split(' '));
  
  // Add new status
  if (status === 'pending') {
    card.element.classList.add(...CARD_PENDING.split(' '));
    card.timeElement.className = TIME_DISPLAY;
    card.timeElement.textContent = '--:--';
  } else if (status === 'active') {
    card.element.classList.add(...CARD_ACTIVE.split(' '));
    card.timeElement.className = `${TIME_DISPLAY} ${TIME_ACTIVE}`;
    // Time updates via clock
  } else if (status === 'completed') {
    card.element.classList.add(...CARD_COMPLETED.split(' '));
    card.timeElement.className = TIME_DISPLAY;
    if (card.completedAt != null) {
      card.timeElement.textContent = formatPlannerDuration(card.completedAt);
    }
    incrementStep();
  }
  
  card.status = status;
  card.element.dataset.status = status;
}

/**
 * Render the entire plan as cards (all pending initially)
 */
export function renderIntentionTimeline(intentionLog = [], agentCount = 0, options = {}) {
  const container = DOM.intentionTimeline();
  if (!container) return;
  
  const { planMoves = [] } = options;
  
  // Clear existing
  container.innerHTML = '';
  timeline.cards = [];
  timeline.container = container;
  
  if (!planMoves || planMoves.length === 0) {
    resetIntentionTimeline('No plan available');
    return;
  }
  
  // Build cards from plan
  let stepNumber = 1;
  planMoves.forEach((moveGroup, groupIdx) => {
    const moves = Array.isArray(moveGroup.moves) ? moveGroup.moves : [moveGroup];
    const isConcurrent = moves.length > 1;
    
    moves.forEach((move, moveIdx) => {
      const actor = move.actor || `Agent-${String.fromCharCode(65 + moveIdx)}`;
      const block = move.block || '?';
      const destination = move.to || 'Table';
      
      const stepLabel = isConcurrent 
        ? `Step ${stepNumber} · Concurrent`
        : `Step ${stepNumber}`;
      
      const summary = move.summary || `Move ${block} → ${destination}`;
      
      let details = null;
      if (move.reason || move.stepDescription || move.detail) {
        details = move.reason || move.stepDescription || move.detail;
      }
      
      const cardData = {
        id: `card-${stepNumber}-${moveIdx}-${actor}`,
        stepNumber,
        actor,
        block,
        destination,
        stepLabel,
        summary,
        details,
        status: 'pending',
        isManual: false,
        completedAt: null,
        element: null,
        timeElement: null
      };
      
      const cardElem = createCard(cardData);
      container.appendChild(cardElem);
      timeline.cards.push(cardData);
      setCardStatus(cardData, 'pending');
    });
    
    stepNumber++;
  });
}

/**
 * Mark a specific move as active or completed
 */
export function markTimelineStep(step) {
  if (!step || !timeline.cards.length) return;
  
  const { block, actor, type } = step;
  if (!block) return;
  
  // On DROP, mark the active card as completed
  if (type === 'DROP') {
    const activeCard = timeline.cards.find(c => 
      c.status === 'active' && 
      c.block === block && 
      (!actor || c.actor === actor)
    );
    
    if (activeCard) {
      activeCard.completedAt = getElapsedTime();
      setCardStatus(activeCard, 'completed');
    }
    return;
  }
  
  // On PICK_UP, mark the pending card as active (only once per move)
  if (type === 'PICK_UP') {
    const pendingCard = timeline.cards.find(c => 
      c.status === 'pending' && 
      c.block === block && 
      (!actor || c.actor === actor)
    );
    
    if (pendingCard) {
      setCardStatus(pendingCard, 'active');
    }
  }
}

/**
 * Finalize all remaining cards
 */
export function finalizeTimeline() {
  const finalTime = getElapsedTime();
  
  timeline.cards.forEach(card => {
    if (card.status !== 'completed') {
      card.completedAt = finalTime;
      setCardStatus(card, 'completed');
    }
  });
}

/**
 * Handle manual intervention: remove uncompleted cards, add manual card, then new plan
 */
export function handleManualIntervention(manualMove, newPlan = []) {
  const container = DOM.intentionTimeline();
  if (!container) return;
  
  // 1. Remove all uncompleted (pending/active) cards from DOM and state
  const completedCards = [];
  timeline.cards.forEach(card => {
    if (card.status === 'completed') {
      completedCards.push(card);
    } else {
      // Remove from DOM
      if (card.element && card.element.parentNode) {
        card.element.parentNode.removeChild(card.element);
      }
    }
  });
  
  timeline.cards = completedCards;
  
  // 2. Add manual intervention card
  const nextStep = completedCards.length + 1;
  const manualCard = {
    id: `card-manual-${Date.now()}`,
    stepNumber: nextStep,
    actor: 'User',
    block: manualMove.block || 'Manual',
    destination: manualMove.to || 'Update',
    stepLabel: `Step ${nextStep} · Manual`,
    summary: manualMove.summary || 'Manual modification',
    details: manualMove.detail || null,
    status: 'completed',
    isManual: true,
    completedAt: getElapsedTime(),
    element: null,
    timeElement: null
  };
  
  const manualElem = createCard(manualCard);
  container.appendChild(manualElem);
  timeline.cards.push(manualCard);
  setCardStatus(manualCard, 'completed');
  
  // 3. Add new planned cards
  if (newPlan && newPlan.length > 0) {
    let stepNumber = nextStep + 1;
    
    newPlan.forEach((moveGroup) => {
      const moves = Array.isArray(moveGroup.moves) ? moveGroup.moves : [moveGroup];
      const isConcurrent = moves.length > 1;
      
      moves.forEach((move, moveIdx) => {
        const actor = move.actor || `Agent-${String.fromCharCode(65 + moveIdx)}`;
        const block = move.block || '?';
        const destination = move.to || 'Table';
        
        const stepLabel = isConcurrent 
          ? `Step ${stepNumber} · Concurrent`
          : `Step ${stepNumber}`;
        
        const summary = move.summary || `Move ${block} → ${destination}`;
        
        let details = null;
        if (move.reason || move.stepDescription || move.detail) {
          details = move.reason || move.stepDescription || move.detail;
        }
        
        const cardData = {
          id: `card-${stepNumber}-${moveIdx}-${actor}`,
          stepNumber,
          actor,
          block,
          destination,
          stepLabel,
          summary,
          details,
          status: 'pending',
          isManual: false,
          completedAt: null,
          element: null,
          timeElement: null
        };
        
        const cardElem = createCard(cardData);
        container.appendChild(cardElem);
        timeline.cards.push(cardData);
        setCardStatus(cardData, 'pending');
      });
      
      stepNumber++;
    });
  }
}

/**
 * Get timeline snapshot for persistence
 */
export function getIntentionTimelineSnapshot() {
  const clockElem = DOM.plannerClock();
  const clockDisplay = clockElem?.textContent || '--:--';
  
  return {
    cards: timeline.cards.map(c => ({
      stepNumber: c.stepNumber,
      actor: c.actor,
      block: c.block,
      status: c.status,
      completedAt: c.completedAt
    })),
    clockDisplay,
    clockStart: timeline.clockStart
  };
}

/**
 * Append new goal moves to existing timeline (for multi-goal sequences)
 */
export function appendNextGoalToTimeline(goalLabel, planMoves = []) {
  const container = DOM.intentionTimeline();
  if (!container) return;
  
  if (!planMoves || planMoves.length === 0) {
    return;
  }
  
  // Add transition card
  const currentStep = timeline.cards.length > 0 
    ? Math.max(...timeline.cards.map(c => c.stepNumber)) + 1
    : 1;
  
  const transitionCard = {
    id: `card-goal-transition-${Date.now()}`,
    stepNumber: currentStep,
    actor: 'System',
    block: '',
    destination: '',
    stepLabel: `Goal Transition`,
    summary: `Moving to next goal: ${goalLabel}`,
    details: null,
    status: 'completed',
    isManual: false,
    completedAt: getElapsedTime(),
    element: null,
    timeElement: null
  };
  
  const transitionElem = createCard(transitionCard);
  container.appendChild(transitionElem);
  timeline.cards.push(transitionCard);
  setCardStatus(transitionCard, 'completed');
  
  // Add new goal moves
  let stepNumber = currentStep + 1;
  planMoves.forEach((moveGroup, groupIdx) => {
    const moves = Array.isArray(moveGroup.moves) ? moveGroup.moves : [moveGroup];
    const isConcurrent = moves.length > 1;
    
    moves.forEach((move, moveIdx) => {
      const actor = move.actor || `Agent-${String.fromCharCode(65 + moveIdx)}`;
      const block = move.block || '?';
      const destination = move.to || 'Table';
      
      const stepLabel = isConcurrent 
        ? `Step ${stepNumber} · Concurrent`
        : `Step ${stepNumber}`;
      
      const summary = move.summary || `Move ${block} → ${destination}`;
      
      let details = null;
      if (move.reason || move.stepDescription || move.detail) {
        details = move.reason || move.stepDescription || move.detail;
      }
      
      const cardData = {
        id: `card-${stepNumber}-${moveIdx}-${actor}`,
        stepNumber,
        actor,
        block,
        destination,
        stepLabel,
        summary,
        details,
        status: 'pending',
        isManual: false,
        completedAt: null,
        element: null,
        timeElement: null
      };
      
      const cardElem = createCard(cardData);
      container.appendChild(cardElem);
      timeline.cards.push(cardData);
      setCardStatus(cardData, 'pending');
    });
    
    stepNumber++;
  });
}

/**
 * Restore timeline from snapshot
 */
export function restoreTimelineFromSnapshot(snapshot) {
  if (!snapshot) {
    resetIntentionTimeline();
    return;
  }
  
  if (snapshot.clockDisplay) {
    updateClockDisplay(snapshot.clockDisplay);
  }
  
  // Restore would need full plan data - simplified for now
  // This is typically called on page load with saved world
}
