const BLOCK_WIDTH = 80;
const BLOCK_HEIGHT = 30;
const WORLD_HEIGHT = 240;
const STACK_MARGIN = 10;
const CLAW_HEIGHT = 25;
const CLAW_WIDTH = 60; // Must match --claw-width in CSS
const CLAW_OFFSET = (BLOCK_WIDTH - CLAW_WIDTH) / 2; // Center claw over blocks (10px)

const worldElem = document.getElementById('world');
const addBlockBtn = document.getElementById('addBlockBtn');
const blockNameInput = document.getElementById('blockName');
const startBtn = document.getElementById('startBtn');
const goalInput = document.getElementById('goalInput');

const claw = document.createElement('div');
claw.id = 'claw';
worldElem.appendChild(claw);

function randomColour() {
  const r = Math.floor((Math.random() * 127) + 128);
  const g = Math.floor((Math.random() * 127) + 128);
  const b = Math.floor((Math.random() * 127) + 128);
  return `rgb(${r}, ${g}, ${b})`;
}

class World {
  constructor(container) {
    this.container = container;
    this.stacks = [];
    this.on = {};
    this.blocks = [];
    this.colours = {};
  }

  addBlock(name) {
    name = name.trim().toUpperCase();
    if (!name) return;
    
    // Check block limit
    const maxBlocks = window.APP_CONFIG?.MAX_BLOCKS || 26;
    if (this.blocks.length >= maxBlocks) {
      this.setMessage(`Maximum ${maxBlocks} blocks allowed.`);
      return;
    }
    
    if (this.blocks.includes(name)) {
      this.setMessage(`Block "${name}" already exists.`);
      return;
    }
    
    this.blocks.push(name);
    this.stacks.push([name]);
    this.on[name] = 'Table';
    this.colours[name] = randomColour();

    const div = document.createElement('div');
    div.className = 'block';
    div.dataset.block = name;
    div.textContent = name;
    div.style.backgroundColor = this.colours[name];
    
    if (this.container) {
      this.container.appendChild(div);
      this.updatePositions();
    }
    
    this.setMessage('');
  }

  moveBlock(block, dest) {
    const fromIndex = this.stacks.findIndex(s => s.includes(block));
    if (fromIndex === -1) throw new Error(`Block ${block} is not in any stack`);
    const stack = this.stacks[fromIndex];
    const removed = stack.pop();
    if (removed !== block) throw new Error(`Attempted to move non-top block ${block}.`);
    if (stack.length === 0) this.stacks.splice(fromIndex, 1);

    if (dest === 'Table') {
      this.stacks.push([block]);
      this.on[block] = 'Table';
    } else {
      const destIndex = this.stacks.findIndex(s => s.includes(dest));
      if (destIndex === -1) throw new Error(`Destination block ${dest} not found`);
      this.stacks[destIndex].push(block);
      this.on[block] = dest;
    }
  }

  getAbove(block) {
    for (const b of this.blocks) {
      if (this.on[b] === block) return b;
    }
    return null;
  }

  isClear(block) {
    return !this.blocks.some(b => this.on[b] === block);
  }

  updatePositions(skipBlock) {
    const width = this.stacks.length * (BLOCK_WIDTH + STACK_MARGIN);
    this.container.style.width = `${width}px`;
    this.stacks.forEach((stack, index) => {
      stack.forEach((blockName, posIdx) => {
        if (blockName === skipBlock) return;
        const div = this.container.querySelector(`[data-block='${blockName}']`);
        if (!div) return;
        const left = index * (BLOCK_WIDTH + STACK_MARGIN);
        const top = WORLD_HEIGHT - (posIdx + 1) * BLOCK_HEIGHT;
        div.style.left = `${left}px`;
        div.style.top = `${top}px`;
      });
    });
  }

  setMessage(msg) {
    const messagesElem = document.getElementById('messages');
    if (messagesElem) {
      messagesElem.textContent = msg;
      messagesElem.className = 'messages';
    }
  }
}

const world = new World(worldElem);

let currentPlan = [];
let planIndex = 0;
let simulating = false;
let currentPlanMeta = null;
let intentionTimelineState = null;
let plannerClockInterval = null;
let plannerClockStart = null;

const intentionTimelineElem = () => document.getElementById('intentionTimeline');
const plannerClockElem = () => document.getElementById('plannerClock');

function formatPlannerDuration(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${base}.${String(hundredths).padStart(2, '0')}`;
}

function updatePlannerClockDisplay(text) {
  const elem = plannerClockElem();
  if (elem) {
    elem.textContent = text ?? '--:--';
  }
}

function stopPlannerClock(finalize = false) {
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

function startPlannerClock() {
  stopPlannerClock(false);
  plannerClockStart = Date.now();
  updatePlannerClockDisplay('00:00.00');
  plannerClockInterval = setInterval(() => {
    if (!plannerClockStart) return;
    updatePlannerClockDisplay(formatPlannerDuration(Date.now() - plannerClockStart));
  }, 125);
}

function resetIntentionTimeline(message = 'No planner data yet.') {
  intentionTimelineState = null;
  const container = intentionTimelineElem();
  if (!container) return;
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'timeline-empty';
  empty.textContent = message;
  container.appendChild(empty);
}

function formatBeliefSnapshot(beliefs) {
  if (!beliefs || typeof beliefs !== 'object') {
    return '';
  }

  const pending = beliefs.pendingRelation
    ? `${beliefs.pendingRelation.block} → ${beliefs.pendingRelation.destination}`
    : 'none';

  const clear = Array.isArray(beliefs.clearBlocks) && beliefs.clearBlocks.length > 0
    ? beliefs.clearBlocks.join(', ')
    : 'none';

  return `Pending relation: ${pending} • Clear blocks: ${clear}`;
}

function renderIntentionTimeline(intentionLog = [], agentCount = 0, options = {}) {
  const container = intentionTimelineElem();
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

function completeTimelineCycle(cycleState) {
  if (!cycleState) return;
  cycleState.entryElement.classList.remove('pending');
  cycleState.entryElement.classList.remove('active');
  cycleState.entryElement.classList.add('completed');
  if (plannerClockStart) {
    cycleState.timeElement.textContent = formatPlannerDuration(Date.now() - plannerClockStart);
  }
}

function markTimelineMove(move) {
  if (!move || !intentionTimelineState) return;
  const moveDest = typeof move.to === 'string' ? move.to.trim().toUpperCase() : 'TABLE';
  for (const cycleState of intentionTimelineState.cycles) {
    if (cycleState.totalMoves === 0) continue;
    if (cycleState.processedMoves >= cycleState.totalMoves) continue;

    const matcher = cycleState.moveStates.find(ms => ms.isAction && !ms.completed && ms.meta && ms.meta.block === move.block && (ms.meta.to || 'Table').toUpperCase() === moveDest);
    if (matcher) {
      matcher.completed = true;
      matcher.element.classList.remove('pending');
      matcher.element.classList.add('done');
      cycleState.processedMoves += 1;

      if (cycleState.processedMoves >= cycleState.totalMoves) {
        completeTimelineCycle(cycleState);
        const nextIndex = cycleState.index + 1;
        const nextActionIndex = intentionTimelineState.cycles.findIndex((c, idx) => idx >= nextIndex && c.totalMoves > 0 && c.processedMoves < c.totalMoves);
        setActiveTimelineCycle(nextActionIndex);
      } else {
        setActiveTimelineCycle(cycleState.index);
      }
      return;
    }
  }
}

function finalizeTimeline() {
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

async function requestBDIPlan(goalChain) {
  const payload = {
    stacks: getCurrentStacks(),
    goalChain
  };

  const plannerConfig = window.APP_CONFIG?.PLANNER || {};
  const maxIterations = Number.isFinite(plannerConfig.MAX_ITERATIONS)
    ? Math.max(1, Math.floor(plannerConfig.MAX_ITERATIONS))
    : undefined;

  if (maxIterations) {
    payload.plannerOptions = { maxIterations };
  }

  const response = await fetch(`${API_BASE}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    const err = new Error(data.message || 'Failed to compute plan.');
    err.status = response.status;
    throw err;

      const beliefText = formatBeliefSnapshot(cycle?.beliefs);
      if (beliefText) {
        const beliefsElem = document.createElement('div');
        beliefsElem.className = 'timeline-beliefs';
        beliefsElem.textContent = beliefText;
        entry.appendChild(beliefsElem);
      }
  }

  if (!data.plannerOptionsUsed) {
    data.plannerOptionsUsed = maxIterations ? { maxIterations } : null;
  }
  return data;
}

function setControlsDisabled(isDisabled) {
  startBtn.disabled = isDisabled;
  addBlockBtn.disabled = isDisabled;
  blockNameInput.disabled = isDisabled;
  goalInput.disabled = isDisabled;
}

function runSimulation() {
  if (simulating) return;
  simulating = true;
  planIndex = 0;
  const meta = currentPlanMeta;
  const agentLabel = meta?.agentCount
    ? (meta.agentCount === 1 ? ' with 1 agent' : ` with ${meta.agentCount} agents`)
    : '';
  const firstActionIndex = intentionTimelineState?.cycles
    ? intentionTimelineState.cycles.findIndex(c => c.totalMoves > 0 && c.processedMoves < c.totalMoves)
    : -1;
  if (currentPlan.length > 0) {
    startPlannerClock();
    if (firstActionIndex >= 0) {
      setActiveTimelineCycle(firstActionIndex);
    }
  } else {
    stopPlannerClock(false);
  }
  const executionMsg = meta
    ? `Executing BDI plan${agentLabel} (${meta.moves} planned moves)...`
    : 'Executing BDI plan...';
  showMessage(executionMsg, 'info');
    setControlsDisabled(true);
  function next() {
    if (planIndex >= currentPlan.length) {
      simulating = false;
      finalizeTimeline();
      stopPlannerClock(true);
      const summaryBase = meta
        ? `Goal achieved! ${meta.moves} moves across ${meta.iterations} BDI cycles${agentLabel}.`
        : 'Goal achieved!';
      const summary = meta?.beliefSummary
        ? `${summaryBase} Final beliefs: ${meta.beliefSummary}.`
        : summaryBase;
      showMessage(summary, 'success');
        setControlsDisabled(false);
      currentPlanMeta = null;
      return;
    }
    const move = currentPlan[planIndex++];
    simulateMove(move, next);
  }
  next();
}

function simulateMove(move, callback) {
  const blockName = move.block;
  const dest = move.to;

  const actorPrefix = move.actor ? `[${move.actor}] ` : '';
  window._logMove?.(`${actorPrefix}Move(${move.block} -> ${move.to})`);

  const blockDiv = worldElem?.querySelector(`[data-block='${blockName}']`);
  if (!blockDiv) {
    console.error('DOM element for block not found:', blockName);
    handleError(new Error(`Block ${blockName} not found in DOM`), 'simulateMove');
    callback();
    return;
  }

  try {
    const startLeft = parseFloat(blockDiv.style.left) || 0;
    const startTop = parseFloat(blockDiv.style.top) || 0;

    // Validate move before executing
    if (!world.blocks.includes(blockName)) {
      throw new Error(`Block ${blockName} not found in world`);
    }

    world.moveBlock(blockName, dest);
    world.updatePositions(blockName);

    const destStackIndex = world.stacks.findIndex(s => s.includes(blockName));
    if (destStackIndex === -1) {
      throw new Error(`Block ${blockName} not found after move`);
    }
    
    const destPosIndex = world.stacks[destStackIndex].indexOf(blockName);
    const destLeft = destStackIndex * (BLOCK_WIDTH + STACK_MARGIN);
    const destTop = WORLD_HEIGHT - (destPosIndex + 1) * BLOCK_HEIGHT;

    // Animate claw
    if (claw) {
      claw.style.transition = 'none';
      claw.style.left = `${startLeft + CLAW_OFFSET}px`;
      claw.style.top = `${startTop - CLAW_HEIGHT}px`;
    }

    blockDiv.classList.add('moving');

    // Force reflow
    void blockDiv.offsetWidth;

    const duration = window.APP_CONFIG?.ANIMATION_DURATION || 550;
    blockDiv.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
    
    if (claw) {
      claw.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
      claw.style.left = `${destLeft + CLAW_OFFSET}px`;
      claw.style.top = `${destTop - CLAW_HEIGHT}px`;
    }
    
    blockDiv.style.left = `${destLeft}px`;
    blockDiv.style.top = `${destTop}px`;

    setTimeout(() => {
      try {
        blockDiv.classList.remove('moving');
        blockDiv.style.transition = '';
        if (claw) {
          claw.style.transition = '';
        }
        world.updatePositions();
        markTimelineMove(move);
        callback();
      } catch (error) {
        handleError(error, 'simulateMove cleanup');
        callback();
      }
    }, duration + 10);
    
  } catch (error) {
    handleError(error, 'simulateMove');
    blockDiv?.classList.remove('moving');
    callback();
  }
}


addBlockBtn.addEventListener('click', () => {
  const name = blockNameInput.value.trim().toUpperCase();
  if (!name) { world.setMessage('Please enter a block name.'); return; }
  if (!/^[A-Za-z]$/.test(name)) {
    world.setMessage('Block name must be a single letter (A-Z).');
    return;
  }
  world.addBlock(name);
  blockNameInput.value = '';
});

blockNameInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') addBlockBtn.click();
});

startBtn.addEventListener('click', async () => {
  if (simulating) return;
  const goalText = goalInput.value.trim();
  if (!goalText) {
    world.setMessage('Please enter a goal stack (e.g. A on C on D).');
    return;
  }
  const tokens = goalText
    .split(/\s*on\s*/i)
    .map(tok => tok.trim().toUpperCase())
    .filter(tok => tok !== '');
  if (tokens.length < 2) {
    world.setMessage('Goal must include at least two blocks (e.g. A on B).');
    return;
  }
  for (const t of tokens) {
    if (!world.blocks.includes(t)) {
      world.setMessage(`Block "${t}" does not exist in the world.`);
      return;
    }
  }
  resetIntentionTimeline('Planning in progress...');
  stopPlannerClock(false);
  setControlsDisabled(true);

  try {
    showMessage('BDI agent is devising a plan...', 'info');
    const planResult = await requestBDIPlan(tokens);

    currentPlan = Array.isArray(planResult.moves) ? planResult.moves : [];
    currentPlanMeta = {
      iterations: planResult.iterations ?? 0,
      moves: currentPlan.length,
      relationsResolved: planResult.relationsResolved ?? Math.max(tokens.length - 1, 0),
      agentCount: planResult.agentCount ?? 1,
      intentionLog: Array.isArray(planResult.intentionLog) ? planResult.intentionLog : [],
      plannerOptions: planResult.plannerOptionsUsed || null,
      beliefs: planResult.beliefs || null,
      beliefSummary: formatBeliefSnapshot(planResult.beliefs)
    };

    renderIntentionTimeline(
      currentPlanMeta.intentionLog,
      currentPlanMeta.agentCount,
      { emptyMessage: 'No planner cycles required for this goal.' }
    );
    updatePlannerClockDisplay('00:00.00');

    if (!planResult.goalAchieved) {
      const errorMessage = currentPlan.length > 0
        ? 'BDI agent produced moves but did not confirm the goal.'
        : 'BDI agent could not achieve the requested goal.';
      showMessage(errorMessage, 'error');
      currentPlan = [];
      currentPlanMeta = null;
      setControlsDisabled(false);
      return;
    }

    if (currentPlan.length === 0) {
      const meta = currentPlanMeta;
      const satisfiedMsg = meta
        ? 'The world already satisfies this goal (no moves required).'
        : 'The world already satisfies this goal.';
      const finalSatisfiedMsg = meta?.beliefSummary
        ? `${satisfiedMsg} Final beliefs: ${meta.beliefSummary}.`
        : satisfiedMsg;
      showMessage(finalSatisfiedMsg, 'success');
      finalizeTimeline();
      stopPlannerClock(false);
      updatePlannerClockDisplay('00:00.00');
      setControlsDisabled(false);
      currentPlan = [];
      currentPlanMeta = null;
      return;
    }

    runSimulation();
  } catch (error) {
    handleError(error, 'planGoal');
    resetIntentionTimeline('Planning failed.');
    stopPlannerClock(false);
    currentPlan = [];
    currentPlanMeta = null;
    setControlsDisabled(false);
  }
});

goalInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') startBtn.click();
});

// Error handling utilities
function handleError(error, context = '') {
  console.error(`Error in ${context}:`, error);
  
  let message = 'An unexpected error occurred';
  
  if (error.name === 'NetworkError' || !navigator.onLine) {
    message = 'Network connection error. Please check your internet connection.';
  } else if (error.message) {
    message = error.message;
  }
  
  showMessage(message, 'error');
}

function showMessage(text, type = 'info') {
  const messagesElem = document.getElementById('messages');
  if (messagesElem) {
    messagesElem.textContent = text;
    messagesElem.className = `messages ${type}`;
    
    // Clear message after 5 seconds for non-error messages
    if (type !== 'error') {
      setTimeout(() => {
        if (messagesElem.textContent === text) {
          messagesElem.textContent = '';
          messagesElem.className = 'messages';
        }
      }, 5000);
    }
  }
}

// Use environment-based configuration
const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

function getCurrentBlocks() { return [...world.blocks]; }
function getCurrentStacks() { return world.stacks.map(s => [...s]); }

function rebuildWorldFrom(stacks) {
  try {
    // Validate input
    if (!Array.isArray(stacks)) {
      throw new Error('Invalid stacks data - must be an array');
    }
    
    // Validate each stack
    for (let i = 0; i < stacks.length; i++) {
      if (!Array.isArray(stacks[i])) {
        throw new Error(`Invalid stack at index ${i} - must be an array`);
      }
    }
    
    // Store current state for potential rollback
    const backup = {
      stacks: [...world.stacks.map(s => [...s])],
      on: {...world.on},
      blocks: [...world.blocks],
      colours: {...world.colours}
    };
    
    // Clear DOM elements
    const worldContainer = document.getElementById('world');
    if (worldContainer) {
      worldContainer.querySelectorAll('.block').forEach(n => n.remove());
    }

    // Reset world state
    world.stacks = [];
    world.on = {};
    world.blocks = [];
    world.colours = {};

    // Get all unique blocks from stacks
    const allBlocks = [...new Set(stacks.flat())];
    
    // Validate block names
    for (const block of allBlocks) {
      if (typeof block !== 'string' || !/^[A-Z]$/.test(block)) {
        // Rollback on invalid data
        world.stacks = backup.stacks;
        world.on = backup.on;
        world.blocks = backup.blocks;
        world.colours = backup.colours;
        throw new Error(`Invalid block name: ${block}. Must be a single uppercase letter.`);
      }
    }
    
    // Add blocks to world
    allBlocks.forEach(name => world.addBlock(name));

    // Set stack configuration
    world.stacks = stacks.map(s => [...s]);

    // Rebuild 'on' relationships
    world.on = {};
    world.stacks.forEach(stack => {
      if (stack.length > 0) {
        world.on[stack[0]] = 'Table';
        for (let i = 1; i < stack.length; i++) {
          world.on[stack[i]] = stack[i - 1];
        }
      }
    });

    world.updatePositions();
    showMessage('World loaded successfully!', 'success');
    
  } catch (error) {
    handleError(error, 'rebuildWorldFrom');
  }
}


async function saveWorld() {
  const name = prompt('World name?');
  if (!name || name.trim().length === 0) {
    showMessage('Please enter a valid world name.', 'error');
    return;
  }
  
  const userId = localStorage.getItem('userId');
  
  if (!userId) {
    showMessage('You must be logged in to save a world.', 'error');
    return;
  }
  
  const payload = { 
    name: name.trim(), 
    blocks: getCurrentBlocks(), 
    stacks: getCurrentStacks(),
    userId
  };
  
  try {
    showMessage('Saving world...', 'info');
    const res = await fetch(`${API_BASE}/worlds`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Save failed with status ${res.status}`);
    }
    
    const savedWorld = await res.json();
    
    showMessage('World saved successfully!', 'success');
    await refreshLoadList();
  } catch (e) {
    handleError(e, 'saveWorld');
  }
}

async function refreshLoadList() {
  const userId = localStorage.getItem('userId');
  const sel = document.getElementById('loadSelect');
  
  if (!sel) return;
  
  sel.innerHTML = '<option value="">-- Select a saved world --</option>';

  if (!userId) {
    return;
  }

  try {
    const url = `${API_BASE}/worlds?userId=${userId}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch saved worlds');
    }
    
    const worlds = await res.json();
    
    if (!Array.isArray(worlds)) {
      throw new Error('Invalid response format');
    }
    
    for (const w of worlds) {
      if (w._id && w.name) {
        const opt = document.createElement('option');
        opt.value = w._id;
        const when = w.createdAt ? new Date(w.createdAt).toLocaleString() : 'Unknown date';
        opt.textContent = `${w.name} (${when})`;
        sel.appendChild(opt);
      }
    }
  } catch (e) {
    handleError(e, 'refreshLoadList');
  }
}




async function loadSelectedWorld() {
  const sel = document.getElementById('loadSelect');
  if (!sel || !sel.value) {
    showMessage('Please select a world to load.', 'error');
    return;
  }
  
  const userId = localStorage.getItem('userId');
  if (!userId) {
    showMessage('You must be logged in to load a world.', 'error');
    return;
  }
  
  try {
    showMessage('Loading world...', 'info');
    const res = await fetch(`${API_BASE}/worlds/${sel.value}?userId=${userId}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Load failed with status ${res.status}`);
    }
    
    const worldDoc = await res.json();
    
    if (!worldDoc.stacks || !Array.isArray(worldDoc.stacks)) {
      throw new Error('Invalid world data format');
    }
    
    rebuildWorldFrom(worldDoc.stacks);
    showMessage('World loaded successfully!', 'success');
  } catch (e) {
    handleError(e, 'loadSelectedWorld');
  }
}

document.getElementById('saveBtn')?.addEventListener('click', saveWorld);
document.getElementById('loadBtn')?.addEventListener('click', loadSelectedWorld);
window.addEventListener('load', refreshLoadList);

resetIntentionTimeline();
updatePlannerClockDisplay('--:--');
