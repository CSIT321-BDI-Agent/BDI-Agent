// Unified route handler wrapper for consistent error handling
const HttpError = require('./httpError');

const withRoute = (handler, { logPrefix, defaultMessage } = {}) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const status = error instanceof HttpError
      ? error.status
      : (typeof error?.status === 'number' ? error.status : null);

    if (status) {
      res.status(status).json({ message: error.message || defaultMessage || 'Request failed' });
      return;
    }

    if (logPrefix) {
      console.error(`${logPrefix}:`, error);
    } else {
      console.error('Unhandled route error:', error);
    }

    res.status(500).json({ message: defaultMessage || 'Server error' });
  }
};

module.exports = withRoute;
