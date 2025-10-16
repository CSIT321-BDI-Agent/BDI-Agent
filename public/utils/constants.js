/**
 * Constants and Configuration for Blocks World Simulation
 * 
 * This file contains all constant values, dimensions, and DOM element references
 * used throughout the application.
 */

const resolveApiBase = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const sanitizeHttpUrl = (value) => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      const portSegment = parsed.port ? `:${parsed.port}` : '';
      return `${parsed.protocol}//${parsed.hostname}${portSegment}`;
    } catch (error) {
      return null;
    }
  };

  const configured = sanitizeHttpUrl(window.APP_CONFIG?.API_BASE);
  if (configured) {
    return configured;
  }

  const { origin, protocol, hostname, port } = window.location || {};
  if (origin && origin !== 'null') {
    const sanitizedOrigin = sanitizeHttpUrl(origin);
    if (sanitizedOrigin) {
      return sanitizedOrigin;
    }
  }

  if (protocol && hostname && ['http:', 'https:'].includes(protocol)) {
    const portSegment = port ? `:${port}` : '';
    return `${protocol}//${hostname}${portSegment}`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3000`;
  }

  return 'http://localhost:3000';
};

// Block and World Dimensions
export const BLOCK_WIDTH = 80;
export const BLOCK_HEIGHT = 30;
export const WORLD_HEIGHT = 320;
export const STACK_MARGIN = 10;

export const BLOCK_COLOUR_PALETTE = [
  '#ff6b6b', '#f06595', '#845ef7', '#5c7cfa', '#339af0', '#22b8cf',
  '#20c997', '#51cf66', '#94d82d', '#fcc419', '#ff922b', '#ff6b3c',
  '#ff8787', '#ff9f43', '#ffa94d', '#ffd43b', '#63e6be', '#38d9a9',
  '#12b886', '#0ca678', '#099268', '#0b7285', '#1864ab', '#364fc7',
  '#4c6ef5', '#9775fa'
];

// Claw Animation Settings
export const CLAW_HEIGHT = 25;
export const CLAW_WIDTH = 60; // Must match --claw-width in CSS
export const CLAW_OFFSET = (BLOCK_WIDTH - CLAW_WIDTH) / 2; // Center claw over blocks (10px)
export const CLAW_ARM_WIDTH = 8;
export const CLAW_ARM_HEIGHT = (() => {
  const configured = window.APP_CONFIG?.SIMULATION?.CLAW_ARM_HEIGHT;
  if (Number.isFinite(configured)) {
    return Math.max(20, Math.round(configured));
  }
  return 280;
})();

// Claw Home Position (top center of world)
export const CLAW_HOME_TOP = 10; // Visible at top of world area
export const CLAW_HOME_LEFT_OFFSET = -30; // Will be calculated based on world width

// Future: Support for multiple claws
export const MAX_CLAWS = 2;

const CLAW_BASE_CLASS = 'absolute z-50 flex h-[25px] w-[60px] items-end justify-center rounded-t-md text-[10px] font-semibold uppercase tracking-[0.28em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.24)] pointer-events-none';
const CLAW_LABEL_CLASS = 'pointer-events-none mb-1 text-[9px] font-semibold uppercase tracking-[0.35em] text-white/85';

const AGENT_CLAW_MAP = {
  'Agent-A': {
    id: 'claw',
    label: 'A',
    classes: `${CLAW_BASE_CLASS} bg-brand-dark`,
    armClass: 'pointer-events-none absolute rounded-b-sm bg-brand-dark/80'
  },
  'Agent-B': {
    id: 'claw-agent-b',
    label: 'B',
    classes: `${CLAW_BASE_CLASS} bg-brand-primary`,
    armClass: 'pointer-events-none absolute rounded-b-sm bg-brand-primary/80'
  }
};

const CLAW_DATA_ATTRIBUTE = 'data-agent-claw';

// API Configuration
export const API_BASE = resolveApiBase();

// DOM Element References (cached)
export const DOM = {
  world: () => document.getElementById('world'),
  addBlockBtn: () => document.getElementById('addBlockBtn'),
  removeBlockBtn: () => document.getElementById('removeBlockBtn'),
  blockCountLabel: () => document.getElementById('blockCountLabel'),
  nextBlockLabel: () => document.getElementById('nextBlockLabel'),
  startBtn: () => document.getElementById('startBtn'),
  goalInput: () => document.getElementById('goalInput'),
  saveBtn: () => document.getElementById('saveBtn'),
  loadBtn: () => document.getElementById('loadBtn'),
  loadSelect: () => document.getElementById('loadSelect'),
  speedSlider: () => document.getElementById('simulationSpeed'),
  speedValueLabel: () => document.getElementById('simulationSpeedValue'),
  messages: () => document.getElementById('messages'),
  intentionTimeline: () => document.getElementById('intentionTimeline'),
  plannerClock: () => document.getElementById('plannerClock'),
  infoGoal: () => document.getElementById('info-goal'),
  infoCurrent: () => document.getElementById('info-current'),
  stats: () => ({
    steps: document.getElementById('stat-steps'),
    time: document.getElementById('stat-time'),
    status: document.getElementById('stat-status')
  }),
  actionLog: () => document.getElementById('actionLog')
};

const parseIndex = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createLabel = (text) => {
  const span = document.createElement('span');
  span.className = CLAW_LABEL_CLASS;
  span.textContent = text;
  return span;
};

export function getAgentClaw(agentKey) {
  const config = AGENT_CLAW_MAP[agentKey];
  if (!config) return null;
  return document.getElementById(config.id);
}

export function getAllAgentClaws() {
  const worldElem = DOM.world();
  if (!worldElem) return [];
  return Array.from(worldElem.querySelectorAll(`[${CLAW_DATA_ATTRIBUTE}='true']`));
}

function applyClawClasses(claw, config, agentKey) {
  claw.className = config.classes;
  claw.dataset.armClass = config.armClass;
  if (agentKey) {
    claw.dataset.agentKey = agentKey;
  }
}

function ensureLabel(claw, text) {
  let label = claw.querySelector('[data-claw-label="true"]');
  if (!label) {
    label = createLabel(text);
    label.dataset.clawLabel = 'true';
    claw.appendChild(label);
  } else {
    label.textContent = text;
  }
}

// Initialize claw element(s)
export function initializeClaw() {
  const primaryClaw = ensureAgentClaw('Agent-A');
  layoutClaws({ durationMs: 0 });
  return primaryClaw;
}

export function ensureAgentClaw(agentKey) {
  const worldElem = DOM.world();
  if (!worldElem) return null;

  const config = AGENT_CLAW_MAP[agentKey];
  if (!config) {
    return null;
  }

  let claw = document.getElementById(config.id);
  if (!claw) {
    claw = document.createElement('div');
    claw.id = config.id;
    claw.setAttribute(CLAW_DATA_ATTRIBUTE, 'true');
    claw.dataset.agentKey = agentKey;
    applyClawClasses(claw, config, agentKey);
    ensureLabel(claw, config.label);
    ensureClawArm(claw);
    worldElem.appendChild(claw);
  } else {
    applyClawClasses(claw, config, agentKey);
    ensureLabel(claw, config.label);
    ensureClawArm(claw);
  }

  return claw;
}

export function removeAgentClaw(agentKey) {
  const config = AGENT_CLAW_MAP[agentKey];
  if (!config) return;
  const claw = document.getElementById(config.id);
  if (claw && claw.parentElement) {
    claw.parentElement.removeChild(claw);
  }
  layoutClaws({ durationMs: 0 });
}

export function layoutClaws({ durationMs = 0 } = {}) {
  const worldElem = DOM.world();
  if (!worldElem) return;
  const claws = getAllAgentClaws();
  if (!claws.length) {
    return;
  }

  claws.forEach((claw, index) => {
    claw.dataset.clawIndex = String(index);
    claw.dataset.clawCount = String(claws.length);
    resetClawToHome(claw, durationMs);
  });
}

// Reset claw to home position (top center)
export function resetClawToHome(claw, durationOverride = null) {
  if (!claw) return;
  
  const worldElem = DOM.world();
  if (!worldElem) return;
  
  const worldWidth = worldElem.offsetWidth || 400;
  const siblings = getAllAgentClaws();
  const count = siblings.length || parseIndex(claw.dataset.clawCount, 1);
  const indexFromDataset = parseIndex(claw.dataset.clawIndex, -1);
  const siblingIndex = siblings.indexOf(claw);
  const resolvedIndex = indexFromDataset >= 0 ? indexFromDataset : Math.max(0, siblingIndex);
  const slotWidth = count > 0 ? worldWidth / (count + 1) : worldWidth / 2;
  const targetLeft = slotWidth * (resolvedIndex + 1) - (CLAW_WIDTH / 2);
  
  const duration = durationOverride ?? window.APP_CONFIG?.ANIMATION_DURATION ?? 550;
  claw.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
  claw.style.left = `${Math.max(0, Math.round(targetLeft))}px`;
  claw.style.top = `${CLAW_HOME_TOP}px`;
  ensureClawArm(claw);
}

// Backward compatibility alias
export const resetClawToDefault = resetClawToHome;

function ensureClawArm(claw) {
  if (!claw) return;
  let arm = claw.querySelector('[data-claw-arm="true"]');
  if (!arm) {
    arm = document.createElement('div');
    arm.dataset.clawArm = 'true';
    arm.className = claw.dataset.armClass || 'pointer-events-none absolute rounded-b-sm bg-brand-dark/80';
    claw.appendChild(arm);
  } else {
    arm.className = claw.dataset.armClass || 'pointer-events-none absolute rounded-b-sm bg-brand-dark/80';
  }

  const width = CLAW_ARM_WIDTH;
  const height = CLAW_ARM_HEIGHT;
  arm.style.width = `${width}px`;
  arm.style.height = `${height}px`;
  arm.style.left = `${(CLAW_WIDTH / 2) - (width / 2)}px`;
  arm.style.top = `${-height}px`;
}
