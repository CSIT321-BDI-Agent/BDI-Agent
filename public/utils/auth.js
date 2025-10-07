/**
 * Authentication Utilities
 * 
 * Centralized authentication management for all frontend pages.
 * Handles localStorage operations, token management, and auth guards.
 */

// Storage keys (matches config.js AUTH settings)
const STORAGE_KEYS = {
  USER_ID: 'userId',
  USERNAME: 'username',
  TOKEN: 'token',
  ROLE: 'role'
};

/**
 * Get current user authentication data
 * @returns {Object|null} User data or null if not authenticated
 */
export function getCurrentUser() {
  const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  
  if (!userId || !token) {
    return null;
  }
  
  return {
    userId,
    username: localStorage.getItem(STORAGE_KEYS.USERNAME),
    token,
    role: localStorage.getItem(STORAGE_KEYS.ROLE) || 'user'
  };
}

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if user is authenticated
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Check if current user has admin role
 * @returns {boolean} True if user is admin
 */
export function isAdmin() {
  const user = getCurrentUser();
  return user !== null && user.role === 'admin';
}

/**
 * Store user authentication data after login/signup
 * @param {Object} data - Authentication response data
 * @param {string} data.userId - User ID
 * @param {string} data.username - Username
 * @param {string} data.token - JWT token
 * @param {string} [data.role] - User role (defaults to 'user')
 */
export function storeAuthData(data) {
  if (!data || !data.userId || !data.token) {
    throw new Error('Invalid auth data: userId and token are required');
  }
  
  localStorage.setItem(STORAGE_KEYS.USER_ID, data.userId);
  localStorage.setItem(STORAGE_KEYS.USERNAME, data.username || '');
  localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
  localStorage.setItem(STORAGE_KEYS.ROLE, data.role || 'user');
}

/**
 * Clear all authentication data (logout)
 */
export function clearAuthData() {
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
  localStorage.removeItem(STORAGE_KEYS.USERNAME);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ROLE);
}

/**
 * Logout and redirect to login page
 * @param {boolean} [confirm=true] - Whether to show confirmation dialog
 */
export function logout(confirm = true) {
  if (confirm && !window.confirm('Are you sure you want to logout?')) {
    return;
  }
  
  clearAuthData();
  const loginPage = window.APP_CONFIG?.AUTH?.LOGIN_PAGE || 'login.html';
  window.location.href = loginPage;
}

/**
 * Redirect to login page if not authenticated (auth guard)
 * Call this at the top of protected pages
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    const loginPage = window.APP_CONFIG?.AUTH?.LOGIN_PAGE || 'login.html';
    window.location.href = loginPage;
  }
}

/**
 * Redirect to main page if already authenticated
 * Call this on login/signup pages to prevent access when logged in
 */
export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    const mainPage = window.APP_CONFIG?.AUTH?.MAIN_PAGE || 'index.html';
    window.location.href = mainPage;
  }
}

/**
 * Redirect to login if not admin (admin auth guard)
 * Call this at the top of admin-only pages
 */
export function requireAdmin() {
  if (!isAdmin()) {
    const loginPage = window.APP_CONFIG?.AUTH?.LOGIN_PAGE || 'login.html';
    window.location.href = loginPage;
  }
}

/**
 * Make an authenticated API request
 * Automatically includes Authorization header with JWT token
 * @param {string} url - API endpoint URL
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  const user = getCurrentUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Authorization': `Bearer ${user.token}`
  };
  
  return fetch(url, { ...options, headers });
}

/**
 * Login user with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} User data with token
 */
export async function login(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';
  
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }
  
  // Ensure username is included in response
  data.username = data.username || username;
  
  storeAuthData(data);
  return data;
}

/**
 * Signup new user
 * @param {string} email - Email address
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} User data with token
 */
export async function signup(email, username, password) {
  if (!email || !username || !password) {
    throw new Error('Email, username, and password are required');
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address');
  }
  
  // Password validation
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  
  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';
  
  const response = await fetch(`${API_BASE}/users/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Signup failed');
  }
  
  // Ensure username is included
  data.username = data.username || username;
  
  storeAuthData(data);
  return data;
}

/**
 * Get authorization header for API requests
 * @returns {Object} Headers object with Authorization
 */
export function getAuthHeaders() {
  const user = getCurrentUser();
  
  if (!user) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${user.token}`
  };
}

/**
 * Update display elements with current user info
 * @param {Object} selectors - CSS selectors for elements to update
 * @param {string} [selectors.username] - Selector for username display
 * @param {string} [selectors.adminNav] - Selector for admin navigation
 * @param {string} [selectors.adminLinks] - Selector for admin link elements
 */
export function updateUIWithUserInfo(selectors = {}) {
  const user = getCurrentUser();
  
  if (!user) return;
  
  // Update username display
  if (selectors.username) {
    const usernameElems = document.querySelectorAll(selectors.username);
    usernameElems.forEach(elem => {
      elem.textContent = `Signed in as ${user.username}`;
    });
  }
  
  // Show admin elements if user is admin
  if (user.role === 'admin') {
    if (selectors.adminNav) {
      const adminNavElems = document.querySelectorAll(selectors.adminNav);
      adminNavElems.forEach(elem => {
        elem.classList.remove('is-hidden');
        elem.removeAttribute('hidden');
        elem.style.display = '';
      });
    }
    
    if (selectors.adminLinks) {
      const adminLinkElems = document.querySelectorAll(selectors.adminLinks);
      adminLinkElems.forEach(elem => {
        elem.style.display = 'block';
      });
    }
  }
}

/**
 * Check if JWT token is expired (client-side check only)
 * Note: This is a basic check and doesn't verify signature
 * @returns {boolean} True if token appears expired
 */
export function isTokenExpired() {
  const user = getCurrentUser();
  
  if (!user || !user.token) return true;
  
  try {
    const payload = JSON.parse(atob(user.token.split('.')[1]));
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiryTime;
  } catch (error) {
    console.error('Failed to parse token:', error);
    return true; // Treat parsing errors as expired
  }
}
