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

  const configured = window.APP_CONFIG?.API_BASE;
  if (typeof configured === 'string') {
    const trimmed = configured.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  const { origin, protocol, hostname, port } = window.location || {};
  if (origin && origin !== 'null') {
    return origin;
  }

  if (protocol && hostname) {
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
export const WORLD_HEIGHT = 240;
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

// Claw Home Position (top center of world)
export const CLAW_HOME_TOP = -40; // Above the world area
export const CLAW_HOME_LEFT_OFFSET = -30; // Will be calculated based on world width

// Future: Support for multiple claws
export const MAX_CLAWS = 1; // Currently single claw, expandable to multiple

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

// Initialize claw element
export function initializeClaw() {
  const worldElem = DOM.world();
  if (!worldElem) return null;
  
  const claw = document.createElement('div');
  claw.id = 'claw';
  claw.className = 'absolute z-50 flex h-[25px] w-[60px] items-end justify-center rounded-t-md bg-brand-dark';
  claw.setAttribute('data-claw-id', '0'); // Future: support for multiple claws
  worldElem.appendChild(claw);
  
  // Set home position at top center
  resetClawToHome(claw);
  
  return claw;
}

// Reset claw to home position (top center)
export function resetClawToHome(claw) {
  if (!claw) return;
  
  const worldElem = DOM.world();
  if (!worldElem) return;
  
  // Calculate center of world area
  const worldWidth = worldElem.offsetWidth || 400; // Default fallback
  const centerLeft = (worldWidth / 2) - (CLAW_WIDTH / 2);
  
  const duration = window.APP_CONFIG?.ANIMATION_DURATION || 550;
  claw.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
  claw.style.left = `${centerLeft}px`;
  claw.style.top = `${CLAW_HOME_TOP}px`;
}

// Backward compatibility alias
export const resetClawToDefault = resetClawToHome;
