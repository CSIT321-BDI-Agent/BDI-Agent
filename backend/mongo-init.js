// MongoDB initialization script
// This runs when the MongoDB container starts for the first time

db = db.getSiblingDB('blocks_world');

// Create collections with proper indexes
db.createCollection('users');
db.createCollection('worlds');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.worlds.createIndex({ user: 1 });
db.worlds.createIndex({ createdAt: -1 });

print('MongoDB initialized for BDI Blocks World');