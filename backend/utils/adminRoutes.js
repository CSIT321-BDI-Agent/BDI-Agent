// utils/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth, checkAdmin } = require('./auth');

// List users (hide passwords)
router.get('/users', requireAuth, checkAdmin, async (_req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
  res.json(users);
});

// Promote user to admin
router.post('/users/:id/promote', requireAuth, checkAdmin, async (req, res) => {
  const updated = await User.findByIdAndUpdate(
    req.params.id,
    { role: 'admin' },
    { new: true, projection: { password: 0 } }
  );
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

// Demote admin to user (won't demote the last admin)
router.post('/users/:id/demote', requireAuth, checkAdmin, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.role === 'admin') {
    const count = await User.countDocuments({ role: 'admin' });
    if (count <= 1) return res.status(400).json({ error: 'Cannot demote the last admin' });
  }
  target.role = 'user';
  await target.save();

  const { password, ...safe } = target.toObject();
  res.json(safe);
});

// Delete user (won't delete the last admin)
router.delete('/users/:id', requireAuth, checkAdmin, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.role === 'admin') {
    const count = await User.countDocuments({ role: 'admin' });
    if (count <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
