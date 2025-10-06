// World model schema for persisting block configurations
const mongoose = require('mongoose');

const WorldSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  blocks: { type: [String], required: true },
  stacks: { type: [[String]], required: true },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const World = mongoose.model('World', WorldSchema);

module.exports = World;
