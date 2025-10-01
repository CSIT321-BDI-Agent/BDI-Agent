// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

// Import utilities and models
const { planBlocksWorld, PlanningError } = require('./bdi/blocksWorldAgent');
const HttpError = require('./utils/httpError');
const withRoute = require('./utils/routeHandler');
const { ensureNonEmptyString, ensureArray, ensureObjectId } = require('./utils/validators');
const { connectDB } = require('./utils/database');
const User = require('./models/User');
const World = require('./models/World');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blocks_world';

// Enhanced CORS configuration for Docker
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://yourdomain.com'])
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://0.0.0.0:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database connection
connectDB(MONGODB_URI);

app.post('/worlds', withRoute(async (req, res) => {
  const { name, blocks, stacks, userId } = req.body || {};

  const normalizedName = ensureNonEmptyString(name, 'Valid world name');
  ensureArray(blocks, 'Blocks');
  ensureArray(stacks, 'Stacks');
  const userObjectId = ensureObjectId(userId, 'User ID');

  try {
    const world = await World.create({
      name: normalizedName,
      blocks,
      stacks,
      user: userObjectId
    });

    res.status(201).json(world);
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new HttpError(400, 'Invalid world data provided');
    }
    throw error;
  }
}, { logPrefix: '❌ Error saving world', defaultMessage: 'Failed to save world' }));

app.get('/worlds', withRoute(async (req, res) => {
  const userObjectId = ensureObjectId(req.query.userId, 'User ID');
  const worlds = await World.find({ user: userObjectId }).sort({ createdAt: -1 });
  res.json(worlds);
}, { logPrefix: '❌ Error fetching worlds', defaultMessage: 'Failed to fetch worlds' }));

app.get('/worlds/:id', withRoute(async (req, res) => {
  const userObjectId = ensureObjectId(req.query.userId, 'User ID');
  const worldId = ensureObjectId(req.params.id, 'World ID');

  const doc = await World.findOne({
    _id: worldId,
    user: userObjectId
  });

  if (!doc) {
    throw new HttpError(404, 'World not found or access denied');
  }

  res.json(doc);
}, { logPrefix: '❌ Error fetching world', defaultMessage: 'Failed to fetch world' }));

// Signup route
app.post('/users/signup', withRoute(async (req, res) => {
  const { email, username, password } = req.body || {};

  const normalizedEmail = ensureNonEmptyString(email, 'Email').toLowerCase();
  const normalizedUsername = ensureNonEmptyString(username, 'Username');
  const normalizedPassword = ensureNonEmptyString(password, 'Password');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new HttpError(400, 'Invalid email format');
  }

  if (normalizedPassword.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters long');
  }

  if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
    throw new HttpError(400, 'Username must be between 3 and 20 characters');
  }

  const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
  if (exists) {
    const field = exists.email === normalizedEmail ? 'Email' : 'Username';
    throw new HttpError(400, `${field} already exists`);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(normalizedPassword, salt);

  try {
    const newUser = await User.create({
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword
    });

    res.status(201).json({
      message: 'User created successfully',
      userId: newUser._id
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = error.keyPattern?.email ? 'Email' : 'Username';
      throw new HttpError(400, `${field} already exists`);
    }
    throw error;
  }
}, { logPrefix: 'Signup error', defaultMessage: 'Server error during registration' }));

app.post('/login', withRoute(async (req, res) => {
  const { username, password } = req.body || {};

  const normalizedUsername = ensureNonEmptyString(username, 'Username');
  const normalizedPassword = ensureNonEmptyString(password, 'Password');

  const user = await User.findOne({ username: normalizedUsername });
  if (!user) {
    throw new HttpError(400, 'Invalid username or password');
  }

  const isMatch = await bcrypt.compare(normalizedPassword, user.password);
  if (!isMatch) {
    throw new HttpError(400, 'Invalid username or password');
  }

  res.json({
    message: 'Login successful!',
    userId: user._id,
    username: user.username
  });
}, { logPrefix: 'Login error', defaultMessage: 'Server error during login' }));

app.post('/plan', withRoute((req, res) => {
  const { stacks, goalChain, plannerOptions, options } = req.body || {};
  const mergedOptions = plannerOptions || options || {};
  const plan = planBlocksWorld(stacks, goalChain, mergedOptions);

  res.json({
    moves: plan.moves,
    iterations: plan.iterations,
    goalAchieved: plan.goalAchieved,
    relationsResolved: plan.relationsResolved,
    agentCount: plan.agentCount,
    intentionLog: plan.intentionLog || [],
    beliefs: plan.beliefs || null,
    plannerOptionsUsed: plan.plannerOptionsUsed || null
  });
}, { logPrefix: 'Plan computation error', defaultMessage: 'Failed to compute plan' }));

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  
  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error;
    res.status(503).json(healthcheck);
  }
});

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: ${MONGODB_URI}`);
});

// Graceful shutdown for Docker
const gracefulShutdown = (signal) => {
  console.log(`\n💀 ${signal} received: closing HTTP server`);
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
