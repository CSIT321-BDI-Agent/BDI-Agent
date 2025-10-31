/**
 * Signup page initialization and handlers
 */
import { signup, redirectIfAuthenticated } from './auth.js';

// Redirect if already logged in
redirectIfAuthenticated();

// Update page title
window.addEventListener('DOMContentLoaded', () => {
  const appName = window.APP_CONFIG?.APP_NAME || 'BDI Blocks World';
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = `Create Account - ${appName}`;
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

// Handle signup form submission
document.getElementById('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  setMessage();

  if (!email || !username || !password || !confirmPassword) {
    setMessage('Please complete all fields.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    setMessage('Passwords do not match. Please try again.', 'error');
    return;
  }

  try {
    setMessage('Creating your account...', 'info');
    await signup(email, username, password);
    setMessage('Account created. Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 900);
  } catch (error) {
    console.error('Signup error:', error);
    setMessage(error.message || 'Signup failed. Please try again.', 'error');
  }
});
