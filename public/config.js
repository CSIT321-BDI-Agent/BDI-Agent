// Default environment configuration for frontend (offline / static fallback)
(function configureAppDefaults() {
  const defaultAuth = {
    REQUIRED: true,
    LOGIN_PAGE: 'login.html',
    MAIN_PAGE: 'index.html'
  };

  const defaultPlanner = {
    MAX_ITERATIONS: 2500
  };

  const defaultSimulation = {
    SPEED_MIN: 0.25,
    SPEED_MAX: 2,
    SPEED_DEFAULT: 1,
    INTERACTION_WINDOW_MS: 750
  };

  const guessOrigin = () => {
    if (typeof window === 'undefined') {
      return 'http://localhost:3000';
    }

    const { origin, protocol, hostname, port } = window.location || {};
    if (origin && origin !== 'null') {
      return origin;
    }

    if (protocol && hostname) {
      const portSegment = port ? `:${port}` : '';
      return `${protocol}//${hostname}${portSegment}`;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:3000`;
    }

    return 'http://localhost:3000';
  };

  const defaults = {
    APP_NAME: 'BDI Blocks World',
    API_BASE: guessOrigin(),
    isDevelopment: (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1'),
    AUTH: defaultAuth,
    ANIMATION_DURATION: 550,
    MAX_BLOCKS: 26,
    MAX_STACK_HEIGHT: 10,
    PLANNER: defaultPlanner,
    SIMULATION: defaultSimulation
  };

  const existing = (typeof window.APP_CONFIG === 'object' && window.APP_CONFIG !== null)
    ? window.APP_CONFIG
    : {};

  window.APP_CONFIG = {
    ...defaults,
    ...existing,
    AUTH: {
      ...defaultAuth,
      ...(existing.AUTH || {})
    },
    PLANNER: {
      ...defaultPlanner,
      ...(existing.PLANNER || {})
    },
    SIMULATION: {
      ...defaultSimulation,
      ...(existing.SIMULATION || {})
    }
  };
})();
