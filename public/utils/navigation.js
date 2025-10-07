/**
 * Navigation helpers for mobile and desktop layouts
 */

let mobileNavInitialized = false;
let sidebarNavInitialized = false;

/**
 * Initialize the hamburger-driven mobile navigation overlay
 */
export function initializeMobileNavigation() {
  if (mobileNavInitialized) return;

  const toggle = document.getElementById('mobileMenuToggle');
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  const closeBtn = document.getElementById('mobileMenuClose');

  if (!toggle || !menu || !overlay) {
    return;
  }

  const openMenu = () => {
    menu.classList.add('active');
    overlay.classList.add('active');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    menu.classList.remove('active');
    overlay.classList.remove('active');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  const navLinks = menu.querySelectorAll('.mobile-menu-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => window.setTimeout(closeMenu, 100));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('active')) {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && menu.classList.contains('active')) {
      closeMenu();
    }
  });

  mobileNavInitialized = true;
}

/**
 * Initialize the sticky sidebar navigation (desktop only)
 */
export function initializeSidebarNavigation({
  defaultRoute = 'dashboard',
  storageKey = 'bdiSidebarCollapsed'
} = {}) {
  if (sidebarNavInitialized) return;

  const sidebar = document.getElementById('sidebar');
  const toggleButton = document.getElementById('sidebarToggle');
  const toggleIcon = document.getElementById('sidebarToggleIcon');
  const toggleText = toggleButton?.querySelector('.sidebar__toggle-text');
  const appLayout = document.querySelector('.app');
  const navLinks = document.querySelectorAll('[data-route]');

  const applyActiveRoute = (route) => {
    navLinks.forEach(link => {
      const isActive = Boolean(route) && link.dataset.route === route;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const attachDisabledHandlers = () => {
    navLinks.forEach(link => {
      if (link.dataset.disabled === 'true' && !link.dataset.navDisabledBound) {
        link.classList.add('is-disabled');
        link.setAttribute('aria-disabled', 'true');
        link.addEventListener('click', (event) => event.preventDefault());
        link.dataset.navDisabledBound = 'true';
      }
    });
  };

  const applySidebarState = (collapsed) => {
    if (!sidebar || !toggleButton || !appLayout) return;
    const isCollapsed = Boolean(collapsed);
    sidebar.setAttribute('data-collapsed', isCollapsed ? 'true' : 'false');
    appLayout.classList.toggle('sidebar-collapsed', isCollapsed);
    toggleButton.setAttribute('aria-expanded', (!isCollapsed).toString());
    if (toggleIcon) toggleIcon.textContent = isCollapsed ? 'chevron_right' : 'chevron_left';
    if (toggleText) toggleText.textContent = isCollapsed ? 'Expand' : 'Collapse';
  };

  const restoreSidebarState = () => {
    if (!sidebar || !toggleButton || !window.localStorage) return;
    const saved = window.localStorage.getItem(storageKey);
    applySidebarState(saved === 'true');
  };

  const handleToggleClick = () => {
    if (!sidebar || !toggleButton || !window.localStorage) return;
    const currentlyCollapsed = sidebar.getAttribute('data-collapsed') === 'true';
    const nextState = !currentlyCollapsed;
    applySidebarState(nextState);
    window.localStorage.setItem(storageKey, nextState ? 'true' : 'false');
  };

  const handleResize = () => {
    if (!sidebar || !toggleButton || !window.localStorage) return;
    if (window.innerWidth < 768) {
      applySidebarState(false);
      window.localStorage.removeItem(storageKey);
    } else {
      restoreSidebarState();
    }
  };

  const resolveRouteFromPath = () => {
    const path = window.location.pathname || '';
    if (path.endsWith('index.html') || path === '/' || path === '') {
      return defaultRoute;
    }
    return null;
  };

  attachDisabledHandlers();
  applyActiveRoute(resolveRouteFromPath());

  if (sidebar && toggleButton && appLayout) {
    restoreSidebarState();
    toggleButton.addEventListener('click', handleToggleClick);
    window.addEventListener('resize', handleResize);
    handleResize();
  }

  sidebarNavInitialized = true;
}
