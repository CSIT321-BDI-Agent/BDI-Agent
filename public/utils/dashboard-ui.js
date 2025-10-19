/**
 * Dashboard page orchestration helpers
 */

import { initializeStatsUI } from './stats.js';
import { initializeLogger } from './logger.js';
import { initializeMobileNavigation, initializeSidebarNavigation } from './navigation.js';
import { initializeProfileMenu } from './profile.js';
import { DOM } from './constants.js';

let dashboardInitialized = false;
let boundWorld = null;

const STACK_PLACEHOLDER = '( - )';

function normalizeGoalTokens(tokens = []) {
  return tokens
    .map((token) => (typeof token === 'string' ? token.trim() : ''))
    .filter(Boolean)
    .map((token) => (token.toLowerCase() === 'table' ? 'Table' : token.toUpperCase()))
    .filter(Boolean);
}

function formatTokensTopDown(tokens = []) {
  const normalized = normalizeGoalTokens(tokens);
  const filtered = normalized.filter((token) => token !== 'Table');
  if (filtered.length === 0) {
    return normalized.includes('Table') ? 'Table' : null;
  }
  return filtered.join(', ');
}

function formatWorldStack(stack) {
  if (!Array.isArray(stack) || stack.length === 0) {
    return null;
  }
  const topDownTokens = [...stack].reverse();
  const formatted = formatTokensTopDown(topDownTokens);
  return formatted && formatted !== 'Table' ? formatted : null;
}

function formatStacksForDisplay(stacks) {
  if (!Array.isArray(stacks) || stacks.length === 0) {
    return STACK_PLACEHOLDER;
  }

  const formattedStacks = stacks
    .map((stack) => formatWorldStack(stack))
    .filter(Boolean);

  if (!formattedStacks.length) {
    return STACK_PLACEHOLDER;
  }

  return `(${formattedStacks.join(' | ')})`;
}

function parseGoalSegments(rawInput) {
  const sanitized = (rawInput || '').trim();
  if (!sanitized) {
    return [];
  }

  const normalized = sanitized.replace(/\s+/g, ' ');
  const segments = normalized
    .split(/\s*(?:\band\b|&|;|\|)\s*/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const resolvedSegments = segments.length ? segments : [normalized];

  return resolvedSegments
    .map((segment) => {
      const tokens = /\bon\b/i.test(segment)
        ? segment.split(/\s*on\s*/i)
        : segment.split(/\s*,\s*/);
      return normalizeGoalTokens(tokens);
    })
    .filter((tokens) => tokens.length > 0);
}

function formatGoalInputForDisplay(rawInput) {
  const goalSegments = parseGoalSegments(rawInput);
  if (!goalSegments.length) {
    return STACK_PLACEHOLDER;
  }

  const formatted = goalSegments
    .map((tokens) => formatTokensTopDown(tokens))
    .filter(Boolean);

  if (!formatted.length) {
    return STACK_PLACEHOLDER;
  }

  return `(${formatted.join(' | ')})`;
}

export function initializeDashboardUI(world) {
  if (world) {
    boundWorld = world;
  }

  if (!dashboardInitialized) {
    initializeStatsUI();
    initializeLogger();
    applyBrandingFromConfig();
    bindGoalPreview();
    bindWorldInfoUpdates();

    initializeMobileNavigation();
    initializeSidebarNavigation({ activeRoute: 'dashboard' });
    initializeProfileMenu();

    dashboardInitialized = true;
  }

  updateWorldInfo();
}

function applyBrandingFromConfig() {
  const appName = window.APP_CONFIG?.APP_NAME || 'BDI Blocks World';
  const mobileBrand = document.getElementById('mobileBrandText');
  const mobileMenuBrand = document.getElementById('mobileMenuBrandText');
  const sidebarBrand = document.getElementById('sidebarTitle');

  if (mobileBrand) mobileBrand.textContent = appName;
  if (mobileMenuBrand) mobileMenuBrand.textContent = appName;
  if (sidebarBrand) sidebarBrand.textContent = appName;
}

function bindGoalPreview() {
  const startBtn = document.getElementById('startBtn');
  const goalInput = document.getElementById('goalInput');
  const infoGoal = DOM.infoGoal();

  if (!goalInput || !infoGoal) return;

  const updateGoalText = () => {
    infoGoal.textContent = formatGoalInputForDisplay(goalInput.value);
  };

  goalInput.addEventListener('input', updateGoalText);
  startBtn?.addEventListener('click', updateGoalText);
  updateGoalText();
}

function bindWorldInfoUpdates() {
  document.addEventListener('world:blocks-changed', updateWorldInfo);
  document.addEventListener('world:stacks-changed', (event) => {
    if (event?.detail?.stacks) {
      updateWorldInfoFromStacks(event.detail.stacks);
    } else {
      updateWorldInfo();
    }
  });
}

export function updateWorldInfoFromStacks(stacks) {
  const infoCurrent = DOM.infoCurrent();
  if (!infoCurrent) return;

  infoCurrent.textContent = formatStacksForDisplay(stacks);
}

function updateWorldInfo() {
  if (!boundWorld || !Array.isArray(boundWorld.stacks)) {
    updateWorldInfoFromStacks(null);
    return;
  }

  updateWorldInfoFromStacks(boundWorld.stacks);
}
