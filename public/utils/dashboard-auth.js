/**
 * Dashboard authentication and initialization
 */
import { requireAuth, logout as authLogout, updateUIWithUserInfo } from './auth.js';

// Require authentication
requireAuth();

// Make logout available globally
window.logout = authLogout;

// Update UI with user info when page loads
window.addEventListener('load', () => {
  updateUIWithUserInfo({
    adminNav: '.admin-nav-link'
  });
});
