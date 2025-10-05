/**
 * Constants and Configuration for Blocks World Simulation
 * 
 * This file contains all constant values, dimensions, and DOM element references
 * used throughout the application.
 */

// Block and World Dimensions
export const BLOCK_WIDTH = 80;
export const BLOCK_HEIGHT = 30;
export const WORLD_HEIGHT = 240;
export const STACK_MARGIN = 10;

// Claw Animation Settings
export const CLAW_HEIGHT = 25;
export const CLAW_WIDTH = 60; // Must match --claw-width in CSS
export const CLAW_OFFSET = (BLOCK_WIDTH - CLAW_WIDTH) / 2; // Center claw over blocks (10px)

// API Configuration
export const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';

// DOM Element References (cached)
export const DOM = {
  world: () => document.getElementById('world'),
  addBlockBtn: () => document.getElementById('addBlockBtn'),
  blockNameInput: () => document.getElementById('blockName'),
  newBlockInput: () => document.getElementById('blockName'),
  startBtn: () => document.getElementById('startBtn'),
  goalInput: () => document.getElementById('goalInput'),
  saveBtn: () => document.getElementById('saveBtn'),
  loadBtn: () => document.getElementById('loadBtn'),
  loadSelect: () => document.getElementById('loadSelect'),
  messages: () => document.getElementById('messages'),
  intentionTimeline: () => document.getElementById('intentionTimeline'),
  plannerClock: () => document.getElementById('plannerClock'),
  worldArea: () => document.getElementById('world')
};

// Initialize claw element
export function initializeClaw() {
  const worldElem = DOM.world();
  if (!worldElem) return null;
  
  const claw = document.createElement('div');
  claw.id = 'claw';
  worldElem.appendChild(claw);
  return claw;
}
