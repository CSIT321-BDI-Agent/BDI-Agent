// utils/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const World = require('../models/World');
const { requireAuth, checkAdmin } = require('./auth');

const formatDurationMs = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const seconds = ms / 1000;
  const precision = seconds >= 10 ? 1 : 2;
  return `${seconds.toFixed(precision)}s`;
};

const parseDurationLabel = (label) => {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2}))?s$/i);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  const centiseconds = match[2] ? Number.parseInt(match[2].padEnd(2, '0'), 10) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(centiseconds)) return null;
  return (seconds * 1000) + (centiseconds * 10);
};

const countTimelineMoves = (timelineLog = []) => {
  if (!Array.isArray(timelineLog) || timelineLog.length === 0) {
    return 0;
  }

  return timelineLog.reduce((total, entry) => {
    if (!entry || !Array.isArray(entry.moves)) {
      return total;
    }
    return total + entry.moves.filter(move => move && move.block && !move.skipped).length;
  }, 0);
};

const normalizeWorldStats = (world) => {
  const rawStats = world && world.stats && typeof world.stats === 'object'
    ? { ...world.stats }
    : null;
  const timelineLog = Array.isArray(world?.timeline?.log) ? world.timeline.log : [];

  const stepsFromStats = rawStats && Number.isFinite(rawStats.steps) ? rawStats.steps : null;
  const derivedSteps = stepsFromStats != null ? stepsFromStats : countTimelineMoves(timelineLog);

  const msFromStats = rawStats && Number.isFinite(rawStats.timeElapsedMs) ? rawStats.timeElapsedMs : null;
  const msFromLabel = rawStats && typeof rawStats.timeElapsed === 'string' ? parseDurationLabel(rawStats.timeElapsed) : null;
  const resolvedMs = msFromStats != null ? msFromStats : msFromLabel;
  const resolvedLabel = rawStats && typeof rawStats.timeElapsed === 'string' && rawStats.timeElapsed.trim().length
    ? rawStats.timeElapsed.trim()
    : formatDurationMs(resolvedMs) || '--';

  const status = rawStats && typeof rawStats.status === 'string' && rawStats.status.trim().length
    ? rawStats.status.trim()
    : (timelineLog.length ? 'Completed' : 'Unknown');

  return {
    steps: derivedSteps != null ? derivedSteps : 0,
    timeElapsedMs: resolvedMs != null ? resolvedMs : null,
    timeElapsed: resolvedLabel,
    status
  };
};

// List users (hide passwords)
router.get('/users', requireAuth, checkAdmin, async (_req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean();
  const userIds = users.map(user => user._id);

  const savedWorlds = await World.find(
    { user: { $in: userIds } },
    {
      name: 1,
      createdAt: 1,
      user: 1,
      stats: 1,
      blocks: 1,
      stacks: 1,
      'timeline.log': 1,
      'timeline.mode': 1,
      'multiAgent.enabled': 1
    }
  ).sort({ createdAt: -1 }).lean();

  const worldsByUser = new Map();
  savedWorlds.forEach(world => {
    const key = world.user.toString();
    if (!worldsByUser.has(key)) {
      worldsByUser.set(key, []);
    }
    const timelineLog = world?.timeline?.log;
    const timelineMode = world?.timeline?.mode;
    const multiAgentEnabled = world?.multiAgent?.enabled;
    worldsByUser.get(key).push({
      name: world.name,
      createdAt: world.createdAt,
      stats: normalizeWorldStats(world),
      blocks: Array.isArray(world.blocks) ? world.blocks : [],
      stacks: Array.isArray(world.stacks) ? world.stacks : [],
      timeline: Array.isArray(timelineLog)
        ? { log: timelineLog, mode: timelineMode }
        : { log: [], mode: timelineMode },
      multiAgent: { enabled: Boolean(multiAgentEnabled ?? (timelineMode === 'multi')) }
    });
  });

  const enriched = users.map(user => {
    const key = user._id.toString();
    const userWorlds = worldsByUser.get(key) || [];

    return {
      ...user,
      savedWorldCount: userWorlds.length,
      savedWorlds: userWorlds
    };
  });

  res.json(enriched);
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
