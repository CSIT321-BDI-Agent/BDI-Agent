/**
 * Shared API base resolution logic for frontend modules.
 *
 * Computes the API origin once, preferring values injected via config.js
 * and falling back to the current browser origin (or localhost for file:// usage).
 */

const sanitizeBase = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed, window.location?.origin || undefined);
    // return protocol + host + optional port without trailing slash
    const portSegment = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${url.hostname}${portSegment}`;
  } catch (error) {
    return null;
  }
};

const computeBrowserOrigin = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const { protocol, hostname, port } = window.location || {};
  if (protocol && hostname) {
    const portSegment = port ? `:${port}` : '';
    return `${protocol}//${hostname}${portSegment}`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3000`;
  }

  return 'http://localhost:3000';
};

export const resolveApiBase = () => {
  const configured = sanitizeBase(window.APP_CONFIG?.API_BASE);
  if (configured) {
    return configured;
  }
  return computeBrowserOrigin();
};

export const API_BASE = resolveApiBase();
