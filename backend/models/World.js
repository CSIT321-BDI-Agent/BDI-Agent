// World model schema for persisting block configurations
const mongoose = require('mongoose');

const WorldSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  blocks: { type: [String], required: true },
  stacks: { type: [[String]], required: true },
  colours: { type: Map, of: String, default: () => ({}) },
  timeline: { type: mongoose.Schema.Types.Mixed, default: null },
  stats: { type: mongoose.Schema.Types.Mixed, default: null },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

WorldSchema.index({ user: 1, name: 1 }, { unique: true });

const World = mongoose.model('World', WorldSchema);

module.exports = World;
