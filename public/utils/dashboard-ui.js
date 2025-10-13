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
    const goalText = goalInput.value.trim();
    infoGoal.textContent = goalText
      ? `(${goalText.split(/\s*on\s*/i).join(', ')})`
      : '( - )';
  };

  goalInput.addEventListener('input', updateGoalText);
  startBtn?.addEventListener('click', updateGoalText);
  updateGoalText();
}

function bindWorldInfoUpdates() {
  document.addEventListener('world:blocks-changed', updateWorldInfo);
}

export function updateWorldInfoFromStacks(stacks) {
  const infoCurrent = DOM.infoCurrent();
  if (!infoCurrent) return;

  if (!Array.isArray(stacks) || stacks.length === 0) {
    infoCurrent.textContent = '( - )';
    return;
  }

  const formatted = stacks
    .map(stack => (Array.isArray(stack) && stack.length ? stack.join(' -> ') : 'Table'))
    .join(' | ');
  infoCurrent.textContent = `(${formatted})`;
}

function updateWorldInfo() {
  if (!boundWorld || !Array.isArray(boundWorld.stacks)) {
    updateWorldInfoFromStacks(null);
    return;
  }

  updateWorldInfoFromStacks(boundWorld.stacks);
}
