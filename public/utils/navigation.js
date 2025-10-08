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
    menu.classList.remove('-translate-x-full');
    menu.classList.add('translate-x-0');
    overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
  };

  const closeMenu = () => {
    menu.classList.add('-translate-x-full');
    menu.classList.remove('translate-x-0');
    overlay.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    overlay.classList.remove('opacity-100');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
  };

  toggle.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  const navLinks = menu.querySelectorAll('.mobile-menu-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => window.setTimeout(closeMenu, 100));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('translate-x-0')) {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && menu.classList.contains('translate-x-0')) {
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
  storageKey = 'bdiSidebarCollapsed',
  activeRoute
} = {}) {
  if (sidebarNavInitialized) return;

  const sidebar = document.getElementById('sidebar');
  const toggleButton = document.getElementById('sidebarToggle');
  const toggleIcon = document.getElementById('sidebarToggleIcon');
  const toggleText = toggleButton?.querySelector('.sidebar__toggle-text');
  const appLayout = document.querySelector('.app');
  const mainContent = document.querySelector('main');
  const navLinks = document.querySelectorAll('[data-route]');
  const collapsibleTexts = sidebar?.querySelectorAll('[data-sidebar-collapsible="text"]') ?? [];
  const collapsibleExpanded = sidebar?.querySelectorAll('[data-sidebar-collapsible="expanded"]') ?? [];

  const applyLinkState = (link, isActive) => {
    const isMobileLink = link.classList.contains('mobile-menu-link');
    const activeClasses = isMobileLink
      ? ['bg-white/10', 'text-white']
      : ['bg-white/10', 'text-white'];
    const inactiveClasses = isMobileLink
      ? ['text-white/80']
      : ['text-white/70'];

    activeClasses.forEach(cls => link.classList.toggle(cls, isActive));
    inactiveClasses.forEach(cls => link.classList.toggle(cls, !isActive));
    if (!isMobileLink) {
      const disabled = link.dataset.disabled === 'true';
      link.classList.toggle('text-white/50', !isActive && disabled);
    }
  };

  const applyActiveRoute = (route) => {
    navLinks.forEach(link => {
      const isActive = Boolean(route) && link.dataset.route === route;
      applyLinkState(link, isActive);
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
        link.classList.add('pointer-events-none', 'opacity-40');
        link.setAttribute('aria-disabled', 'true');
        link.addEventListener('click', (event) => event.preventDefault());
        link.dataset.navDisabledBound = 'true';
      }
    });
  };

  const applySidebarState = (collapsed) => {
    if (!sidebar || !toggleButton || !appLayout || !mainContent) return;
    const isCollapsed = Boolean(collapsed);
    sidebar.setAttribute('data-collapsed', isCollapsed ? 'true' : 'false');
    sidebar.classList.toggle('md:w-72', !isCollapsed);
    sidebar.classList.toggle('md:w-24', isCollapsed);
    sidebar.classList.toggle('md:px-6', !isCollapsed);
    sidebar.classList.toggle('md:px-3', isCollapsed);
    collapsibleTexts.forEach(elem => {
      elem.classList.toggle('md:hidden', isCollapsed);
    });
    collapsibleExpanded.forEach(elem => {
      elem.classList.toggle('md:hidden', isCollapsed);
    });
    mainContent.classList.toggle('md:ml-72', !isCollapsed);
    mainContent.classList.toggle('md:ml-24', isCollapsed);
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
    if (!sidebar || !toggleButton || !window.localStorage || !mainContent) return;
    if (window.innerWidth < 768) {
      applySidebarState(false);
      window.localStorage.removeItem(storageKey);
      mainContent.classList.remove('md:ml-72', 'md:ml-24');
    } else {
      restoreSidebarState();
    }
  };

  const resolveRouteFromPath = () => {
    const path = window.location.pathname || '';
    if (path.endsWith('index.html') || path === '/' || path === '') {
      return defaultRoute;
    }
    if (path.endsWith('admin.html')) {
      return 'admin';
    }
    return null;
  };

  attachDisabledHandlers();

  const resolvedRoute = typeof activeRoute === 'string'
    ? activeRoute
    : resolveRouteFromPath();

  if (resolvedRoute) {
    applyActiveRoute(resolvedRoute);
  }

  if (sidebar && toggleButton && appLayout) {
    restoreSidebarState();
    toggleButton.addEventListener('click', handleToggleClick);
    window.addEventListener('resize', handleResize);
    handleResize();
  }

  sidebarNavInitialized = true;
}
