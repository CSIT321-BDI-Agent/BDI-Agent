
const BLOCK_WIDTH = 80;
const BLOCK_HEIGHT = 30;
const WORLD_HEIGHT = 240;
const STACK_MARGIN = 10;
const CLAW_HEIGHT = 25;

const worldElem = document.getElementById('world');
const messagesElem = document.getElementById('messages');
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
    this.container.appendChild(div);
    this.updatePositions();
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
    messagesElem.textContent = msg;
  }
}

const world = new World(worldElem);

function computePlan(chain) {
  const cloneStacks = JSON.parse(JSON.stringify(world.stacks));
  const cloneOn = { ...world.on };
  const cloneBlocks = [...world.blocks];

  function getAbove(b) {
    for (const x of cloneBlocks) {
      if (cloneOn[x] === b) return x;
    }
    return null;
  }
  function isClear(b) {
    return !cloneBlocks.some(x => cloneOn[x] === b);
  }
  function moveBlockInPlan(block, dest, plan) {
    const fromIndex = cloneStacks.findIndex(s => s.includes(block));
    const fromStack = cloneStacks[fromIndex];
    fromStack.pop();
    if (fromStack.length === 0) cloneStacks.splice(fromIndex, 1);
    if (dest === 'Table') {
      cloneStacks.push([block]);
      cloneOn[block] = 'Table';
    } else {
      const destIndex = cloneStacks.findIndex(s => s.includes(dest));
      cloneStacks[destIndex].push(block);
      cloneOn[block] = dest;
    }
    plan.push({ block: block, to: dest });
  }
  function clearBlock(b, plan) {
    let top = getAbove(b);
    while (top) {
      clearBlock(top, plan);
      moveBlockInPlan(top, 'Table', plan);
      top = getAbove(b);
    }
  }
  function putOn(x, y, plan) {
    if (cloneOn[x] === y) return;
    if (!isClear(x)) clearBlock(x, plan);
    if (y !== 'Table' && !isClear(y)) clearBlock(y, plan);
    moveBlockInPlan(x, y, plan);
  }

  const plan = [];
  for (let i = chain.length - 1; i >= 1; i--) {
    const x = chain[i - 1];
    const y = chain[i];
    putOn(x, y, plan);
  }
  return plan;
}

let currentPlan = [];
let planIndex = 0;
let simulating = false;

function runSimulation() {
  if (simulating) return;
  simulating = true;
  planIndex = 0;
  messagesElem.textContent = '';
  startBtn.disabled = true;
  addBlockBtn.disabled = true;
  blockNameInput.disabled = true;
  goalInput.disabled = true;
  function next() {
    if (planIndex >= currentPlan.length) {
      simulating = false;
      messagesElem.textContent = 'Goal achieved!';
      startBtn.disabled = false;
      addBlockBtn.disabled = false;
      blockNameInput.disabled = false;
      goalInput.disabled = false;
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

  window._logMove?.(`Move(${move.block} -> ${move.to})`);

  const blockDiv = worldElem.querySelector(`[data-block='${blockName}']`);
  if (!blockDiv) {
    console.error('DOM element for block not found:', blockName);
    callback();
    return;
  }

  const startLeft = parseFloat(blockDiv.style.left) || 0;
  const startTop = parseFloat(blockDiv.style.top) || 0;

  world.moveBlock(blockName, dest);

  world.updatePositions(blockName);

  const destStackIndex = world.stacks.findIndex(s => s.includes(blockName));
  const destPosIndex = world.stacks[destStackIndex].indexOf(blockName);
  const destLeft = destStackIndex * (BLOCK_WIDTH + STACK_MARGIN);
  const destTop = WORLD_HEIGHT - (destPosIndex + 1) * BLOCK_HEIGHT;

  claw.style.transition = 'none';
  claw.style.left = `${startLeft}px`;
  claw.style.top = `${startTop - CLAW_HEIGHT}px`;

  blockDiv.classList.add('moving');

  void claw.offsetWidth;

  const duration = 550;
  blockDiv.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
  claw.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
  blockDiv.style.left = `${destLeft}px`;
  blockDiv.style.top = `${destTop}px`;
  claw.style.left = `${destLeft}px`;
  claw.style.top = `${destTop - CLAW_HEIGHT}px`;

  setTimeout(() => {
    blockDiv.classList.remove('moving');
    blockDiv.style.transition = '';
    claw.style.transition = '';
    world.updatePositions();
    callback();
  }, duration + 10);
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

startBtn.addEventListener('click', () => {
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
  currentPlan = computePlan(tokens);
  if (currentPlan.length === 0) {
    world.setMessage('The world already satisfies this goal.');
    return;
  }
  runSimulation();
});

goalInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') startBtn.click();
});

const API_BASE = 'http://localhost:3000';

function getCurrentBlocks() { return [...world.blocks]; }
function getCurrentStacks() { return world.stacks.map(s => [...s]); }

function rebuildWorldFrom(stacks) {
  worldElem.querySelectorAll('.block').forEach(n => n.remove());

  world.stacks = [];
  world.on = {};
  world.blocks = [];
  world.colours = {};

  const all = [...new Set(stacks.flat())];
  all.forEach(name => world.addBlock(name));

  world.stacks = stacks.map(s => [...s]);

  
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
  world.setMessage('World loaded.');
}


async function saveWorld() {
  const name = prompt('World name?');
  if (!name) return;
  const userId = localStorage.getItem('userId');  // <--- new
  if (!userId) {
    alert('You must be logged in to save a world.');
    return;
  }
  const payload = { 
    name, 
    blocks: getCurrentBlocks(), 
    stacks: getCurrentStacks(),
    userId  // <--- new
  };
  try {
    const res = await fetch(`${API_BASE}/worlds`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Save failed');
    alert('Saved!');
    await refreshLoadList();
  } catch (e) {
    alert('Save failed.');
    console.error(e);
  }
}

async function refreshLoadList() {
  const userId = localStorage.getItem('userId');
  const sel = document.getElementById('loadSelect');
  sel.innerHTML = '<option value="">-- Select a saved world --</option>';

  if (!userId) return;

  try {
    const res = await fetch(`${API_BASE}/worlds?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch saved worlds");
    const worlds = await res.json();
    
    for (const w of worlds) {
      const opt = document.createElement('option');
      opt.value = w._id;
      const when = new Date(w.createdAt).toLocaleString();
      opt.textContent = `${w.name} (${when})`;
      sel.appendChild(opt);
    }
  } catch (e) {
    console.warn('Could not refresh saved list:', e);
  }
}




async function loadSelectedWorld() {
  const sel = document.getElementById('loadSelect');
  if (!sel.value) return;
  try {
    const res = await fetch(`${API_BASE}/worlds/${sel.value}`);
    if (!res.ok) throw new Error('Load failed');
    const worldDoc = await res.json();
    rebuildWorldFrom(worldDoc.stacks);
  } catch (e) {
    alert('Load failed.');
    console.error(e);
  }
}

document.getElementById('saveBtn')?.addEventListener('click', saveWorld);
document.getElementById('loadBtn')?.addEventListener('click', loadSelectedWorld);
window.addEventListener('load', refreshLoadList);
