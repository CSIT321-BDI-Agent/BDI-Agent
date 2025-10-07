const DEFAULT_SECRET = 'dev-secret';
let warnedAboutFallback = false;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production environments.');
  }

  if (!warnedAboutFallback) {
    console.warn('[auth] JWT_SECRET not set; using insecure development secret.');
    warnedAboutFallback = true;
  }

  return DEFAULT_SECRET;
}

module.exports = {
  getJwtSecret,
  DEFAULT_SECRET
};
