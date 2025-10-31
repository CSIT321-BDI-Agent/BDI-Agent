// utils/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('./jwt');

const JWT_SECRET = getJwtSecret();

async function attachUser(req, _res, next) {
  try {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload?.sub) {
        const user = await User.findById(payload.sub).lean();
        if (user) req.user = user;
      }
    }
  } catch {
    // ignore bad/expired token
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });

  const status = typeof req.user.status === 'string' ? req.user.status : 'active';
  if (status !== 'active') {
    return res.status(403).json({ error: 'Account is not active' });
  }

  next();
}

function checkAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  const status = typeof req.user.status === 'string' ? req.user.status : 'active';
  if (status !== 'active') return res.status(403).json({ error: 'Account is not active' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

module.exports = { attachUser, requireAuth, checkAdmin };
