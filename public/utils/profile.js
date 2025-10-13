/**
 * Profile page and menu interactions
 */

import {
  requireAuth,
  getCurrentUser,
  authenticatedFetch,
  logout as authLogout,
  updateUIWithUserInfo,
  storeAuthData
} from './auth.js';
import { initializeMobileNavigation, initializeSidebarNavigation } from './navigation.js';
import { API_BASE } from './constants.js';

let profileMenuInitialized = false;
let profilePageInitialized = false;

/**
 * Initialize the profile page functionality
 */
export function initializeProfilePage() {
  if (profilePageInitialized) return;

  requireAuth();

  initializeMobileNavigation();
  initializeSidebarNavigation({ activeRoute: 'profile', storageKey: 'bdiSidebarCollapsed' });
  initializeProfileMenu();

  updateUIWithUserInfo({
    adminNav: '.admin-nav-link'
  });

  window.logout = authLogout;

  const apiBase = API_BASE;

  const profileNameDisplay = document.getElementById('profileName');
  const usernameDisplay = document.getElementById('detailUsername');
  const emailDisplay = document.getElementById('detailEmail');
  const roleDisplay = document.getElementById('detailRole');
  const userIdDisplay = document.getElementById('detailUserId');
  const worldsDisplay = document.getElementById('detailWorlds');
  const worldsList = document.getElementById('detailWorldsList');

  const usernameForm = document.getElementById('usernameForm');
  const newUsernameInput = document.getElementById('newUsername');
  const usernamePasswordInput = document.getElementById('usernameCurrentPassword');
  const usernameSubmit = document.getElementById('usernameSubmit');
  const usernameMessage = document.getElementById('usernameMessage');

  const passwordForm = document.getElementById('passwordForm');
  const passwordCurrentInput = document.getElementById('passwordCurrent');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const passwordSubmit = document.getElementById('passwordSubmit');
  const passwordMessage = document.getElementById('passwordMessage');

  const flashMessage = document.getElementById('profileFlash');

  let currentProfile = null;

  const setFeedback = (element, text = '', type = 'info') => {
    if (!element) return;
    if (element.dataset.timeoutId) {
      window.clearTimeout(Number(element.dataset.timeoutId));
      element.dataset.timeoutId = '';
    }
    if (!text) {
      element.className = element.dataset.inline === 'true'
        ? 'messages hidden'
        : 'hidden text-sm';
      element.textContent = '';
      return;
    }
    if (element.dataset.inline === 'true') {
      const BASE = 'messages inline-flex items-center gap-2 border px-3 py-2 text-sm font-medium transition-all duration-200 ml-auto whitespace-nowrap';
      const TONE_MAP = {
        success: `${BASE} border-emerald-300 bg-emerald-50 text-emerald-700`,
        error: `${BASE} border-red-300 bg-red-50 text-red-600`,
        info: `${BASE} border-brand-primary/30 bg-brand-primary/10 text-brand-dark`
      };
      element.className = TONE_MAP[type] || TONE_MAP.info;
      const timeoutId = window.setTimeout(() => {
        if (element.textContent === text) {
          element.className = 'messages hidden';
          element.textContent = '';
        }
        element.dataset.timeoutId = '';
      }, 5000);
      element.dataset.timeoutId = String(timeoutId);
    } else {
      const base = 'text-sm font-medium mt-2';
      const tone = {
        success: 'text-emerald-600',
        error: 'text-red-600',
        info: 'text-brand-primary'
      }[type] || 'text-brand-primary';
      element.className = `${base} ${tone}`;
    }
    element.textContent = text;
  };

  const setFlash = (text = '', type = 'info') => {
    if (!flashMessage) return;
    const BASE = 'messages block mt-6 border px-4 py-3 text-sm font-medium transition-all duration-200';
    const map = {
      info: `${BASE} border-brand-primary/30 bg-brand-primary/10 text-brand-dark`,
      success: `${BASE} border-emerald-300 bg-emerald-50 text-emerald-700`,
      error: `${BASE} border-red-300 bg-red-50 text-red-600`
    };
    if (!text) {
      flashMessage.textContent = '';
      flashMessage.className = 'messages hidden';
      return;
    }
    flashMessage.textContent = text;
    flashMessage.className = map[type] || map.info;
  };

  const populateProfile = (data) => {
    currentProfile = data;
    const session = getCurrentUser();
    if (session && session.token) {
      storeAuthData({
        userId: session.userId,
        username: data.username || session.username,
        role: data.role || session.role,
        token: session.token,
        email: data.email || session.email
      });
    }
    if (usernameDisplay) usernameDisplay.textContent = data.username || 'Unknown';
    if (emailDisplay) emailDisplay.textContent = data.email || '--';
    if (roleDisplay) roleDisplay.textContent = (data.role || 'user').toLowerCase();
    if (userIdDisplay) userIdDisplay.textContent = data.userId || '--';
    
    const savedWorlds = Array.isArray(data.savedWorlds) ? data.savedWorlds : [];
    const savedWorldCount = Number.isFinite(data.savedWorldCount) ? data.savedWorldCount : savedWorlds.length;
    const countLabel = savedWorldCount === 0
      ? 'No worlds saved yet'
      : `${savedWorldCount} ${savedWorldCount === 1 ? 'world' : 'worlds'}`;
    if (worldsDisplay) worldsDisplay.textContent = countLabel;

    if (worldsList) {
      worldsList.innerHTML = '';
      if (savedWorlds.length === 0) {
        worldsList.classList.add('hidden');
      } else {
        worldsList.classList.remove('hidden');
        savedWorlds.forEach((world) => {
          const item = document.createElement('li');
          const name = typeof world?.name === 'string' && world.name.trim().length > 0
            ? world.name.trim()
            : 'Untitled world';
          const savedDate = world?.createdAt
            ? new Date(world.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
            : null;
          item.textContent = savedDate ? `${name} - saved ${savedDate}` : name;
          worldsList.appendChild(item);
        });
      }
    }
    if (profileNameDisplay) {
      profileNameDisplay.textContent = data.username || 'Guest';
    }
  };

  const fetchProfile = async (options = {}) => {
    const { preserveMessages = false } = options;
    try {
      const response = await authenticatedFetch(`${apiBase}/users/me`, { method: 'GET' });
      if (!response.ok) {
        throw new Error('Unable to load profile details');
      }
      const payload = await response.json();
      populateProfile(payload);
      if (!preserveMessages) {
        setFeedback(usernameMessage);
        setFeedback(passwordMessage);
      }
    } catch (error) {
      console.error('Profile load error:', error);
      setFlash(error.message || 'Unable to load profile details.', 'error');
    }
  };

  // Username form handler
  if (usernameForm) {
    usernameForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(usernameMessage);
      setFlash();

      const newUsername = newUsernameInput?.value.trim();
      const currentPassword = usernamePasswordInput?.value.trim();

      if (!newUsername) {
        setFeedback(usernameMessage, 'Please enter a new username.', 'error');
        return;
      }
      if (currentProfile && newUsername.toLowerCase() === (currentProfile.username || '').toLowerCase()) {
        setFeedback(usernameMessage, 'You are already using that username.', 'error');
        return;
      }
      if (!currentPassword) {
        setFeedback(usernameMessage, 'Please provide your current password to confirm.', 'error');
        return;
      }

      if (usernameSubmit) usernameSubmit.disabled = true;

      try {
        const response = await authenticatedFetch(`${apiBase}/users/me`, {
          method: 'PATCH',
          body: JSON.stringify({ oldPassword: currentPassword, username: newUsername })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to update username');
        }

        storeAuthData({
          userId: payload.user.userId,
          username: payload.user.username,
          role: payload.user.role,
          token: payload.token,
          email: payload.user.email
        });

        setFeedback(usernameMessage, 'Username updated successfully.', 'success');
        if (newUsernameInput) newUsernameInput.value = '';
        if (usernamePasswordInput) usernamePasswordInput.value = '';
        await fetchProfile({ preserveMessages: true });
        updateUIWithUserInfo({ adminNav: '.admin-nav-link' });
      } catch (error) {
        console.error('Username update error:', error);
        setFeedback(usernameMessage, error.message || 'Unable to update username.', 'error');
      } finally {
        if (usernameSubmit) usernameSubmit.disabled = false;
      }
    });
  }

  // Password form handler
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(passwordMessage);
      setFlash();

      const currentPassword = passwordCurrentInput?.value.trim();
      const newPassword = newPasswordInput?.value.trim();
      const confirmPassword = confirmPasswordInput?.value.trim();

      if (!currentPassword) {
        setFeedback(passwordMessage, 'Please provide your current password.', 'error');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setFeedback(passwordMessage, 'New password must be at least 6 characters.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        setFeedback(passwordMessage, 'New password and confirmation do not match.', 'error');
        return;
      }

      if (passwordSubmit) passwordSubmit.disabled = true;

      try {
        const response = await authenticatedFetch(`${apiBase}/users/me`, {
          method: 'PATCH',
          body: JSON.stringify({ oldPassword: currentPassword, password: newPassword })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to update password');
        }

        storeAuthData({
          userId: payload.user.userId,
          username: payload.user.username,
          role: payload.user.role,
          token: payload.token,
          email: payload.user.email
        });

        setFeedback(passwordMessage, 'Password updated successfully.', 'success');
        if (passwordCurrentInput) passwordCurrentInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
        await fetchProfile({ preserveMessages: true });
        updateUIWithUserInfo({ adminNav: '.admin-nav-link' });
      } catch (error) {
        console.error('Password update error:', error);
        setFeedback(passwordMessage, error.message || 'Unable to update password.', 'error');
      } finally {
        if (passwordSubmit) passwordSubmit.disabled = false;
      }
    });
  }

  // Set page title on load
  window.addEventListener('DOMContentLoaded', () => {
    const appName = window.APP_CONFIG?.APP_NAME || 'BDI Blocks World';
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = `Profile - ${appName}`;
  });

  // Initial profile fetch
  fetchProfile();

  profilePageInitialized = true;
}

/**
 * Profile menu interactions (top-right account dropdown)
 */
export function initializeProfileMenu() {
  if (profileMenuInitialized) return;

  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  const profileName = document.getElementById('profileName');
  const profileMenuLoggedIn = document.getElementById('profileMenuLoggedIn');
  const profileMenuLoggedOut = document.getElementById('profileMenuLoggedOut');
  const adminMenuItem = document.getElementById('adminMenuItem');
  const adminBanner = document.querySelector('#adminNav');

  if (!profileBtn || !profileMenu || !profileName || !profileMenuLoggedIn || !profileMenuLoggedOut) {
    return;
  }

  const showElement = (element, displayClass = 'flex') => {
    if (!element) return;
    element.classList.remove('hidden');
    if (displayClass) {
      element.classList.add(displayClass);
    }
  };

  const hideElement = (element, displayClass = 'flex') => {
    if (!element) return;
    element.classList.add('hidden');
    if (displayClass) {
      element.classList.remove(displayClass);
    }
  };

  const updateProfileDisplay = () => {
    const username = window.localStorage?.getItem('username');
    const token = window.localStorage?.getItem('token');
    const role = window.localStorage?.getItem('role');

    if (token && username) {
      profileName.textContent = username;
      showElement(profileMenuLoggedIn, 'flex');
      hideElement(profileMenuLoggedOut, 'flex');
      if (adminMenuItem) {
        if (role === 'admin') {
          showElement(adminMenuItem, 'flex');
        } else {
          hideElement(adminMenuItem, 'flex');
        }
      }
      if (adminBanner) {
        if (role === 'admin') {
          showElement(adminBanner, 'flex');
        } else {
          hideElement(adminBanner, 'flex');
        }
      }
    } else {
      profileName.textContent = 'Guest';
      hideElement(profileMenuLoggedIn, 'flex');
      showElement(profileMenuLoggedOut, 'flex');
      if (adminMenuItem) {
        hideElement(adminMenuItem, 'flex');
      }
      if (adminBanner) {
        hideElement(adminBanner, 'flex');
      }
    }
  };

  let isAnimating = false;
  let isMenuOpen = false;

  const openMenu = () => {
    if (isAnimating || isMenuOpen) return;
    
    isAnimating = true;
    isMenuOpen = true;
    
    // Set initial collapsed state BEFORE removing hidden class
    profileMenu.style.transformOrigin = 'top right';
    profileMenu.style.transform = 'scaleY(0) translateY(-10px)';
    profileMenu.style.opacity = '0';
    profileMenu.style.transition = 'none'; // No transition for initial state
    
    // Remove hidden class to make it visible (but still collapsed)
    profileMenu.classList.remove('hidden');
    
    // Force a reflow to ensure the element is rendered with collapsed state
    void profileMenu.offsetHeight;
    
    // Now enable transitions
    profileMenu.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out';
    
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      profileMenu.style.transform = 'scaleY(1) translateY(0)';
      profileMenu.style.opacity = '1';
      
      // Animation complete
      setTimeout(() => {
        isAnimating = false;
      }, 300);
    });
    
    profileBtn.setAttribute('aria-expanded', 'true');
  };

  const closeMenu = () => {
    if (isAnimating || !isMenuOpen) return;
    
    isAnimating = true;
    isMenuOpen = false;
    
    // Animate out with roll-up effect
    profileMenu.style.transformOrigin = 'top right';
    profileMenu.style.transform = 'scaleY(0) translateY(-10px)';
    profileMenu.style.opacity = '0';
    profileMenu.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in';
    
    // Hide after animation completes
    setTimeout(() => {
      profileMenu.classList.add('hidden');
      profileMenu.style.transform = '';
      profileMenu.style.opacity = '';
      profileMenu.style.transition = '';
      isAnimating = false;
    }, 250);
    
    profileBtn.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = (event) => {
    event.stopPropagation();
    
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  profileBtn.addEventListener('click', toggleMenu);

  document.addEventListener('click', (event) => {
    if (isMenuOpen && !profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMenuOpen) {
      closeMenu();
    }
  });

  updateProfileDisplay();
  window.addEventListener('storage', updateProfileDisplay);

  profileMenuInitialized = true;
}
