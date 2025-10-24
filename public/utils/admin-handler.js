/**
 * Admin page initialization and handlers
 */
import { requireAdmin, logout as authLogout, authenticatedFetch, updateUIWithUserInfo } from './auth.js';
import { initializeMobileNavigation, initializeSidebarNavigation } from './navigation.js';
import { initializeProfileMenu } from './profile.js';

requireAdmin();
window.logout = authLogout;

const statusEl = document.getElementById('status');
const rows = document.getElementById('users');

async function api(path, opts = {}) {
  const res = await authenticatedFetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatTimeElapsed = (stats = {}) => {
  if (!stats) return '--';
  if (typeof stats.timeElapsed === 'string' && stats.timeElapsed.trim().length) {
    return escapeHtml(stats.timeElapsed.trim());
  }
  if (Number.isFinite(stats.timeElapsedMs)) {
    const seconds = stats.timeElapsedMs / 1000;
    return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;
  }
  return '--';
};

const formatSavedWorldsList = (worlds = []) => {
  if (!Array.isArray(worlds) || worlds.length === 0) {
    return `
      <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-brand-dark/70 shadow-sm">
        This user has no saved worlds.
      </div>
    `;
  }

  const cards = worlds.map(world => {
    const name = escapeHtml(world?.name || 'Untitled world');
    const savedAt = world?.createdAt
      ? new Date(world.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null;
    const stats = world?.stats || {};
    const steps = Number.isFinite(stats.steps) ? stats.steps : '--';
    const timeElapsed = formatTimeElapsed(stats);
    const status = typeof stats.status === 'string' && stats.status.trim().length
      ? escapeHtml(stats.status.trim())
      : 'Unknown';
    const timeline = world?.timeline || {};
    const timelineCards = Array.isArray(timeline.cards) ? timeline.cards : [];
    const distinctSteps = timelineCards.length
      ? new Set(
          timelineCards
            .map((card) => (Number.isFinite(card?.stepNumber) ? card.stepNumber : card?.id || card?.summary || ''))
            .filter(Boolean)
        ).size
      : Array.isArray(timeline.log) ? timeline.log.length : 0;
    const cardCount = timelineCards.length;
    
    // Debug: Check what data we're getting
    console.log(world?.multiAgent);
    
    const agentModeDisplay = world?.multiAgent.enabled ? 'Multi-Agent' : 'Single Agent';

    return `
      <article class="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-brand-dark">${name}</h4>
          <span class="text-[11px] text-brand-dark/60">${savedAt ? escapeHtml(`Saved ${savedAt}`) : 'Unknown date'}</span>
        </div>
        <dl class="mt-3 grid gap-3 text-[11px] text-brand-dark/70 sm:grid-cols-4">
          <div>
            <dt class="font-semibold uppercase tracking-[0.18em] text-brand-dark/50">Steps</dt>
            <dd class="mt-1 text-sm font-semibold text-brand-dark">${steps}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-[0.18em] text-brand-dark/50">Time</dt>
            <dd class="mt-1 text-sm font-semibold text-brand-dark">${timeElapsed}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-[0.18em] text-brand-dark/50">Status</dt>
            <dd class="mt-1 text-sm font-semibold text-brand-dark">${status}</dd>
          </div>
          <div>
            <dt class="font-semibold uppercase tracking-[0.18em] text-brand-dark/50">Agent Mode</dt>
            <dd class="mt-1 text-sm font-semibold text-brand-dark">${agentModeDisplay}</dd>
          </div>
        </dl>
      </article>
    `;
  }).join('');

  return `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">${cards}</div>`;
};

async function loadUsers() {
  try {
    statusEl.textContent = 'Loading users...';
    const list = await api('/admin/users');
    rows.innerHTML = '';

    list.forEach(user => {
      const userId = user._id;
      const username = escapeHtml(user.username || 'Unknown');
      const email = escapeHtml(user.email || '--');
      const roleRaw = user.role || 'user';
      const roleLabel = escapeHtml(roleRaw);
      const savedWorldCount = Number.isFinite(user.savedWorldCount)
        ? user.savedWorldCount
        : Array.isArray(user.savedWorlds)
          ? user.savedWorlds.length
          : 0;
      const hasWorlds = savedWorldCount > 0;
      const countLabel = `${savedWorldCount} ${savedWorldCount === 1 ? 'world' : 'worlds'}`;

      const worldsCellContent = hasWorlds
        ? `<button type="button" class="saved-worlds-toggle inline-flex items-center gap-1 rounded border border-brand-primary/40 bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/20" data-count="${savedWorldCount}" data-target="worlds-${userId}" aria-expanded="false" onclick="toggleWorlds('${userId}', this)">View ${escapeHtml(countLabel)} ▾</button>`
        : `<span class="text-xs font-medium text-slate-500">0 worlds</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3 font-semibold text-brand-dark">${username}</td>
        <td class="px-4 py-3">${email}</td>
        <td class="px-4 py-3 capitalize">${roleLabel}</td>
        <td class="px-4 py-3">${worldsCellContent}</td>
        <td class="px-4 py-3 text-right space-x-2">
          ${roleRaw !== 'admin' ? `<button class="action inline-flex items-center gap-1 bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/20" onclick="promote('${userId}')">Promote</button>` : ''}
          ${roleRaw === 'admin' ? `<button class="action inline-flex items-center gap-1 bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-300" onclick="demote('${userId}')">Demote</button>` : ''}
          <button class="action inline-flex items-center gap-1 bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-200" onclick="removeUser('${userId}')">Delete</button>
        </td>`;
      rows.appendChild(tr);

      const detailsRow = document.createElement('tr');
      detailsRow.id = `worlds-${userId}`;
      detailsRow.className = 'hidden bg-slate-50';
      detailsRow.innerHTML = `<td colspan="5" class="px-4 py-3">${formatSavedWorldsList(user.savedWorlds)}</td>`;
      rows.appendChild(detailsRow);
    });

    statusEl.textContent = list.length ? 'Users loaded.' : 'No users found.';
  } catch (error) {
    statusEl.textContent = 'Error: ' + error.message;
  }
}

async function promote(id) {
  await api(`/admin/users/${id}/promote`, { method: 'POST' });
  loadUsers();
}

async function demote(id) {
  await api(`/admin/users/${id}/demote`, { method: 'POST' });
  loadUsers();
}

async function removeUser(id) {
  await api(`/admin/users/${id}`, { method: 'DELETE' });
  loadUsers();
}

function toggleWorlds(id, trigger) {
  const row = document.getElementById(`worlds-${id}`);
  if (!row) return;

  const willShow = row.classList.contains('hidden');
  row.classList.toggle('hidden', !willShow);

  if (trigger) {
    trigger.setAttribute('aria-expanded', willShow.toString());
    const count = Number(trigger.dataset.count || '0');
    const label = count === 1 ? 'world' : 'worlds';
    const arrow = willShow ? '▴' : '▾';
    trigger.textContent = `${willShow ? 'Hide' : 'View'} ${count} ${label} ${arrow}`;
  }
}

function applyBranding() {
  const appName = window.APP_CONFIG?.APP_NAME || 'BDI Blocks World';
  const mobileBrand = document.getElementById('mobileBrandText');
  const mobileMenuBrand = document.getElementById('mobileMenuBrandText');
  const sidebarBrand = document.getElementById('sidebarTitle');

  if (mobileBrand) mobileBrand.textContent = appName;
  if (mobileMenuBrand) mobileMenuBrand.textContent = appName;
  if (sidebarBrand) sidebarBrand.textContent = appName;
}

// Initialize
initializeMobileNavigation();
initializeSidebarNavigation({ storageKey: 'bdiSidebarCollapsed', activeRoute: 'admin' });
initializeProfileMenu();
applyBranding();
updateUIWithUserInfo({ adminNav: '.admin-nav-link' });

// Expose functions to global scope for onclick handlers
window.promote = promote;
window.demote = demote;
window.removeUser = removeUser;
window.toggleWorlds = toggleWorlds;

// Load users on page load
loadUsers();
