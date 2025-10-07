/**
 * Dashboard page orchestration helpers
 */

import { initializeStatsUI } from './stats.js';
import { initializeLogger } from './logger.js';
import { initializeMobileNavigation, initializeSidebarNavigation } from './navigation.js';
import { initializeProfileMenu } from './profile.js';

let worldInfoIntervalId = null;
let dashboardInitialized = false;

export function initializeDashboardUI(world) {
  if (dashboardInitialized) {
    // Ensure world info ticker uses latest world instance
    if (world) {
      startWorldInfoTicker(world);
    }
    return;
  }

  initializeStatsUI();
  initializeLogger();
  applyBrandingFromConfig();
  bindGoalPreview();
  startWorldInfoTicker(world);

  initializeMobileNavigation();
  initializeSidebarNavigation();
  initializeProfileMenu();

  // Clean up ticker on page unload to avoid stray timers
  window.addEventListener('beforeunload', () => {
    if (worldInfoIntervalId) {
      clearInterval(worldInfoIntervalId);
      worldInfoIntervalId = null;
    }
  }, { once: true });

  dashboardInitialized = true;
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
  const infoGoal = document.getElementById('info-goal');

  if (!startBtn || !goalInput || !infoGoal) return;

  startBtn.addEventListener('click', () => {
    const goalText = goalInput.value.trim();
    if (goalText) {
      infoGoal.textContent = `(${goalText.split(/\s*on\s*/i).join(', ')})`;
    }
  });
}

function startWorldInfoTicker(world) {
  const infoCurrent = document.getElementById('info-current');
  if (!infoCurrent || !world) return;

  if (worldInfoIntervalId) {
    clearInterval(worldInfoIntervalId);
  }

  worldInfoIntervalId = window.setInterval(() => {
    if (!world || !Array.isArray(world.stacks)) return;
    const formatted = world.stacks
      .map(stack => stack.join(', '))
      .join(' | ');
    infoCurrent.textContent = `(${formatted})`;
  }, 500);
}
