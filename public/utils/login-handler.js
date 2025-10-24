/**
 * Login page initialization and handlers
 */
import { login, redirectIfAuthenticated } from './auth.js';

// Redirect if already logged in
redirectIfAuthenticated();

// Update page title
window.addEventListener('DOMContentLoaded', () => {
  const appName = window.APP_CONFIG?.APP_NAME || 'BDI Blocks World';
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = `Sign In - ${appName}`;
});

const messages = document.getElementById('messages');

function setMessage(text = '', type = 'info') {
  if (!messages) return;

  const BASE = 'messages block mt-4 w-full border px-4 py-3 text-sm font-medium transition-all duration-200';
  const TYPE_MAP = {
    info: `${BASE} border-brand-primary/30 bg-brand-primary/10 text-brand-dark`,
    success: `${BASE} border-green-300 bg-green-50 text-green-700`,
    error: `${BASE} border-red-300 bg-red-50 text-red-600`
  };

  if (!text) {
    messages.textContent = '';
    messages.className = 'messages hidden';
    return;
  }

  messages.textContent = text;
  messages.className = TYPE_MAP[type] || TYPE_MAP.info;
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  setMessage();

  if (!username || !password) {
    setMessage('Please enter both username and password.', 'error');
    return;
  }

  try {
    setMessage('Signing you in...', 'info');

    const data = await login(username, password);

    setMessage('Login successful. Redirecting...', 'success');

    setTimeout(() => {
      if (data.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'index.html';
      }
    }, 800);
  } catch (err) {
    console.error('Login error:', err);
    setMessage(err.message || 'Login failed. Please try again.', 'error');
  }
});
