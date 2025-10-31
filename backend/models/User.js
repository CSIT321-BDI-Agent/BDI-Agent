// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const USER_ROLES = ['user', 'admin'];
const USER_STATUS = ['active', 'pending', 'suspended'];

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // bcrypt hash
  role:     { type: String, enum: USER_ROLES, default: 'user' },
  status:   { type: String, enum: USER_STATUS, default: 'active', index: true }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

/**
 * Create a default admin if there is no admin yet.
 * Uses env vars ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD.
 */
async function ensureDefaultAdmin() {
  const exists = await User.exists({ role: 'admin' });
  if (exists) return;

  const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD environment variable must be set to create the default admin user.');
  }

  const hash = await bcrypt.hash(password, 10);
  await User.create({ email, username, password: hash, role: 'admin', status: 'active' });

  console.log(`[seed] Default admin created -> ${username} (${email})`);
}

module.exports = User;
module.exports.ensureDefaultAdmin = ensureDefaultAdmin;
module.exports.USER_STATUS = USER_STATUS;
