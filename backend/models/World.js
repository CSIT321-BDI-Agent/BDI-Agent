// World model schema for persisting block configurations
const mongoose = require('mongoose');

const WorldSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  blocks: { type: [String], required: true },
  stacks: { type: [[String]], required: true },
  colours: { type: Map, of: String, default: () => ({}) },
  timeline: { type: mongoose.Schema.Types.Mixed, default: null },
  stats: {
    type: {
      steps: { type: Number, default: 0 },
      timeElapsedMs: { type: Number, default: 0 },
      timeElapsed: { type: String, default: '--' },
      status: { type: String, default: '--' }
    },
    default: null
  },
  multiAgent: {
    type: {
      enabled: { type: Boolean, default: false }
    },
    required: true
  },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

WorldSchema.index({ user: 1, name: 1 }, { unique: true });

const World = mongoose.model('World', WorldSchema);

module.exports = World;
