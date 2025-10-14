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
  const sidebarContent = sidebar?.querySelector('[data-sidebar-content]');
  const brandContainer = sidebar?.querySelector('[data-sidebar-brand]');
  const collapsibleTexts = sidebar?.querySelectorAll('[data-sidebar-collapsible="text"]') ?? [];
  const collapsibleExpanded = sidebar?.querySelectorAll('[data-sidebar-collapsible="expanded"]') ?? [];

  const applyLinkState = (link, isActive) => {
    const isMobileLink = link.classList.contains('mobile-menu-link');
    const activeClasses = isMobileLink
      ? ['bg-white/10', 'text-white']
      : ['text-white'];
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

  const updateSlidingIndicator = (activeLink, skipTransition = false) => {
    const indicator = document.getElementById('sidebarActiveIndicator');
    const sidebarNav = document.getElementById('sidebarNav');
    
    if (!indicator || !sidebarNav || !activeLink) {
      return;
    }

    // Get the position of the active link relative to the nav container
    const navRect = sidebarNav.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const offsetTop = linkRect.top - navRect.top;
    
    // Temporarily disable transition if needed
    if (skipTransition) {
      indicator.style.transition = 'none';
    }
    
    // Position and show the indicator
    indicator.style.transform = `translateY(${offsetTop}px)`;
    indicator.style.height = `${linkRect.height}px`;
    indicator.style.opacity = '1';
    
    // Re-enable transition after a frame
    if (skipTransition) {
      requestAnimationFrame(() => {
        indicator.style.transition = '';
      });
    }
  };

  const applyActiveRoute = (route, skipTransition = false) => {
    let activeLink = null;
    
    navLinks.forEach(link => {
      const isActive = Boolean(route) && link.dataset.route === route;
      applyLinkState(link, isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
        if (!link.classList.contains('mobile-menu-link')) {
          activeLink = link;
        }
      } else {
        link.removeAttribute('aria-current');
      }
    });
    
    // Update the sliding indicator for sidebar links
    if (activeLink) {
      updateSlidingIndicator(activeLink, skipTransition);
    }
    
    return activeLink;
  };

  const attachHoverHandlers = () => {
    const indicator = document.getElementById('sidebarActiveIndicator');
    const sidebarNav = document.getElementById('sidebarNav');
    
    if (!indicator || !sidebarNav) return;
    
    // Store the currently active link
    let currentActiveLink = null;
    
    // Find the current active link
    navLinks.forEach(link => {
      if (link.getAttribute('aria-current') === 'page' && !link.classList.contains('mobile-menu-link')) {
        currentActiveLink = link;
      }
    });
    
    navLinks.forEach(link => {
      // Only add hover effects to sidebar links (not mobile menu)
      if (link.classList.contains('mobile-menu-link')) return;
      
      // Skip disabled links
      if (link.dataset.disabled === 'true') return;
      
      link.addEventListener('mouseenter', () => {
        // Move indicator to hovered link with elastic easing
        const navRect = sidebarNav.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        const offsetTop = linkRect.top - navRect.top;
        
        // Use a snappier transition for hover
        indicator.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.3s ease-out';
        indicator.style.transform = `translateY(${offsetTop}px)`;
        indicator.style.height = `${linkRect.height}px`;
      });
      
      link.addEventListener('mouseleave', () => {
        // Rubber-band back to active link with bounce effect
        if (currentActiveLink) {
          const navRect = sidebarNav.getBoundingClientRect();
          const linkRect = currentActiveLink.getBoundingClientRect();
          const offsetTop = linkRect.top - navRect.top;
          
          // Use elastic easing for rubber-band effect
          indicator.style.transition = 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), height 0.3s ease-out';
          indicator.style.transform = `translateY(${offsetTop}px)`;
          indicator.style.height = `${linkRect.height}px`;
          
          // Reset to default transition after animation completes
          setTimeout(() => {
            indicator.style.transition = '';
          }, 500);
        }
      });
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

  const applySidebarState = (collapsed, skipTransition = false) => {
    if (!sidebar || !toggleButton || !appLayout || !mainContent) return;
    const isCollapsed = Boolean(collapsed);
    
    // Temporarily disable ALL transitions if requested (for initial page load)
    // Remove transition classes to prevent any animation
    let sidebarTransitionClasses = [];
    let mainContentTransitionClasses = [];
    
    if (skipTransition) {
      // Store and remove transition classes from sidebar
      const sidebarClasses = Array.from(sidebar.classList);
      sidebarTransitionClasses = sidebarClasses.filter(cls => 
        cls.includes('transition') || cls.includes('duration') || cls.includes('ease')
      );
      sidebarTransitionClasses.forEach(cls => sidebar.classList.remove(cls));
      
      // Store and remove transition classes from mainContent
      const mainClasses = Array.from(mainContent.classList);
      mainContentTransitionClasses = mainClasses.filter(cls => 
        cls.includes('transition') || cls.includes('duration') || cls.includes('ease')
      );
      mainContentTransitionClasses.forEach(cls => mainContent.classList.remove(cls));
      
      // Also set no-transition class as fallback
      sidebar.classList.add('no-transition');
      mainContent.classList.add('no-transition');
    }
    
    sidebar.setAttribute('data-collapsed', isCollapsed ? 'true' : 'false');
    sidebar.classList.toggle('is-collapsed', isCollapsed);
    sidebar.classList.toggle('md:w-72', !isCollapsed);
    sidebar.classList.toggle('md:w-24', isCollapsed);
    collapsibleTexts.forEach(elem => {
      elem.classList.toggle('md:hidden', isCollapsed);
    });
    collapsibleExpanded.forEach(elem => {
      elem.classList.toggle('md:hidden', isCollapsed);
    });
    if (sidebarContent) {
      sidebarContent.classList.toggle('md:px-6', !isCollapsed);
      sidebarContent.classList.toggle('md:px-3', isCollapsed);
    }
    if (brandContainer) {
      brandContainer.classList.toggle('md:justify-start', !isCollapsed);
      brandContainer.classList.toggle('md:justify-center', isCollapsed);
    }
    mainContent.classList.toggle('md:ml-72', !isCollapsed);
    mainContent.classList.toggle('md:ml-24', isCollapsed);
    appLayout.classList.toggle('sidebar-collapsed', isCollapsed);
    toggleButton.setAttribute('aria-expanded', (!isCollapsed).toString());
    if (toggleIcon) toggleIcon.textContent = isCollapsed ? 'chevron_right' : 'chevron_left';
    if (toggleText) toggleText.textContent = isCollapsed ? 'Expand' : 'Collapse';
    
    // Re-enable transitions after state is fully applied
    if (skipTransition) {
      // Force a reflow to ensure the style changes are applied before re-enabling transitions
      void sidebar.offsetWidth;
      void mainContent.offsetWidth;
      
      // Restore transition classes
      sidebarTransitionClasses.forEach(cls => sidebar.classList.add(cls));
      mainContentTransitionClasses.forEach(cls => mainContent.classList.add(cls));
      
      // Remove inline styles
      sidebar.style.transition = '';
      mainContent.style.transition = '';
    }
  };

  const restoreSidebarState = () => {
    if (!sidebar || !toggleButton || !window.localStorage) return;
    const saved = window.localStorage.getItem(storageKey);
    // Skip transition on initial restore to prevent animation flash
    applySidebarState(saved === 'true', true);
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
  if (path.endsWith('profile.html')) {
    return 'profile';
  }
  if (path.endsWith('admin.html')) {
    return 'admin';
  }
  if (path.endsWith('agent-logs.html')) {
    return 'agent-logs';
  }
  if (path.endsWith('import-export.html')) {
    return 'import-export';
  }
  return null;
};

  attachDisabledHandlers();

  const resolvedRoute = typeof activeRoute === 'string'
    ? activeRoute
    : resolveRouteFromPath();

  if (resolvedRoute) {
    // Skip transition on initial page load to prevent flash
    applyActiveRoute(resolvedRoute, true);
  }

  if (sidebar && toggleButton && appLayout) {
    restoreSidebarState();
    toggleButton.addEventListener('click', handleToggleClick);
    window.addEventListener('resize', handleResize);
    handleResize();
  }

  // Attach hover handlers for sliding indicator effect
  attachHoverHandlers();

  sidebarNavInitialized = true;
}
