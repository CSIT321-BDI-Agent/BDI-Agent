// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');                  

// Import utilities and models
const { planBlocksWorld, PlanningError } = require('./bdi/blocksWorldAgent');
const HttpError = require('./utils/httpError');
const withRoute = require('./utils/routeHandler');
const { ensureNonEmptyString, ensureArray, ensureObjectId } = require('./utils/validators');
const { connectDB } = require('./utils/database');
const User = require('./models/User');
const { ensureDefaultAdmin } = require('./models/User');   
const World = require('./models/World');

const { attachUser, requireAuth } = require('./utils/auth');      
const adminRoutes = require('./utils/adminRoutes');  
const { getJwtSecret } = require('./utils/jwt');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blocks_world';
const JWT_SECRET = getJwtSecret();
const BLOCK_NAME_REGEX = /^[A-Z]$/;
const MAX_ITERATION_CAP = 5000;

const sanitizeColourMap = (input) => {
  if (!input || typeof input !== 'object') {
    return {};
  }

  return Object.entries(input).reduce((acc, [key, value]) => {
    if (typeof key === 'string' && typeof value === 'string') {
      acc[key.trim()] = value;
    }
    return acc;
  }, {});
};

const sanitizeTimelineSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  if (!Array.isArray(snapshot.log)) {
    return null;
  }

  return snapshot;
};

const normalizeBlocksList = (blocks) => {
  return blocks.map((block, index) => {
    const normalized = ensureNonEmptyString(block, `Block at index ${index}`);
    const upper = normalized.toUpperCase();
    if (!BLOCK_NAME_REGEX.test(upper)) {
      throw new HttpError(400, `Invalid block name "${block}" in blocks list.`);
    }
    return upper;
  });
};

const sanitizeStatsSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const result = {};
  if (Number.isFinite(snapshot.steps)) {
    result.steps = Number(snapshot.steps);
  }
  if (snapshot.stepsDisplay != null) {
    const display = String(snapshot.stepsDisplay).trim();
    if (display.length > 0 && display !== '--') {
      result.stepsDisplay = display;
    }
  }
  if (typeof snapshot.time === 'string') {
    const timeValue = snapshot.time.trim();
    if (timeValue.length > 0 && timeValue !== '--') {
      result.time = timeValue;
    }
  }
  if (typeof snapshot.status === 'string') {
    const statusValue = snapshot.status.trim();
    if (statusValue.length > 0 && statusValue !== '--') {
      result.status = statusValue;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};

const sanitizeWorldPayload = (raw = {}) => {
  const {
    name,
    blocks,
    stacks,
    colours,
    colors,
    timeline,
    stats
  } = raw;

  const normalizedName = ensureNonEmptyString(name, 'Valid world name');
  const blocksArray = ensureArray(blocks, 'Blocks');
  const stacksArray = ensureArray(stacks, 'Stacks');

  return {
    name: normalizedName,
    blocks: normalizeBlocksList(blocksArray),
    stacks: validateStacksPayload(stacksArray).map(stack => [...stack]),
    colours: sanitizeColourMap(colours ?? colors),
    timeline: sanitizeTimelineSnapshot(timeline),
    stats: sanitizeStatsSnapshot(stats)
  };
};

const validateStacksPayload = (stacks) => {
  if (!Array.isArray(stacks)) {
    throw new HttpError(400, 'Stacks must be an array of arrays.');
  }

  stacks.forEach((stack, stackIndex) => {
    if (!Array.isArray(stack)) {
      throw new HttpError(400, `Stack at index ${stackIndex} must be an array.`);
    }

    stack.forEach((block, blockIndex) => {
      if (typeof block !== 'string' || !BLOCK_NAME_REGEX.test(block)) {
        throw new HttpError(400, `Invalid block name at stack ${stackIndex}, position ${blockIndex}.`);
      }
    });
  });

  return stacks;
};

const validateGoalChain = (goalChain) => {
  if (goalChain == null) {
    return goalChain;
  }

  if (!Array.isArray(goalChain)) {
    throw new HttpError(400, 'Goal chain must be an array of block identifiers.');
  }

  return goalChain.map((item, index) => {
    if (typeof item !== 'string' || (!BLOCK_NAME_REGEX.test(item) && item !== 'Table')) {
      throw new HttpError(400, `Invalid goal entry at position ${index}.`);
    }
    return item;
  });
};

const sanitizePlannerOptions = (options = {}) => {
  const sanitized = {};
  if (options.maxIterations !== undefined) {
    const maxIterations = Number(options.maxIterations);
    if (!Number.isFinite(maxIterations) || maxIterations <= 0) {
      throw new HttpError(400, 'maxIterations must be a positive number.');
    }
    sanitized.maxIterations = Math.min(Math.floor(maxIterations), MAX_ITERATION_CAP);
  }
  return sanitized;
};

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

app.use(attachUser);

// Initialize database connection
connectDB(MONGODB_URI);

// ------------------ Worlds Routes ------------------
app.post('/worlds', requireAuth, withRoute(async (req, res) => {
  const sanitizedPayload = sanitizeWorldPayload(req.body || {});

  const existing = await World.findOne({ user: req.user._id, name: sanitizedPayload.name });
  if (existing) {
    throw new HttpError(409, `World name "${sanitizedPayload.name}" already exists. Choose a different name.`);
  }

  try {
    const world = await World.create({
      ...sanitizedPayload,
      user: req.user._id
    });

    res.status(201).json(world);
  } catch (error) {
    if (error && error.code === 11000) {
      throw new HttpError(409, `World name "${sanitizedPayload.name}" already exists. Choose a different name.`);
    }
    throw error;
  }
}));

app.get('/worlds', requireAuth, withRoute(async (req, res) => {
  const worlds = await World.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(worlds);
}));

app.get('/worlds/:id', requireAuth, withRoute(async (req, res) => {
  const worldId = ensureObjectId(req.params.id, 'World ID');

  const doc = await World.findOne({ _id: worldId, user: req.user._id });
  if (!doc) throw new HttpError(404, 'World not found or access denied');

  res.json(doc);
}));

// ------------------ User Auth ------------------

// Signup route
app.post('/users/signup', withRoute(async (req, res) => {
  const { email, username, password } = req.body || {};

  const normalizedEmail = ensureNonEmptyString(email, 'Email').toLowerCase();
  const normalizedUsername = ensureNonEmptyString(username, 'Username');
  const normalizedPassword = ensureNonEmptyString(password, 'Password');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) throw new HttpError(400, 'Invalid email format');
  if (normalizedPassword.length < 6) throw new HttpError(400, 'Password must be at least 6 characters long');
  if (normalizedUsername.length < 3 || normalizedUsername.length > 20)
    throw new HttpError(400, 'Username must be between 3 and 20 characters');

  const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
  if (exists) throw new HttpError(400, 'Email or Username already exists');

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(normalizedPassword, salt);

  const newUser = await User.create({
    email: normalizedEmail,
    username: normalizedUsername,
    password: hashedPassword
  });

  const token = jwt.sign(
    { sub: newUser._id.toString(), role: newUser.role, username: newUser.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ 
    message: 'User created successfully', 
    userId: newUser._id,
    username: newUser.username,
    role: newUser.role,
    token
  });
}));

app.post('/login', withRoute(async (req, res) => {
  const { username, password } = req.body || {};

  const normalizedUsername = ensureNonEmptyString(username, 'Username');
  const normalizedPassword = ensureNonEmptyString(password, 'Password');

  const user = await User.findOne({ username: normalizedUsername });
  if (!user) throw new HttpError(400, 'Invalid username or password');

  const isMatch = await bcrypt.compare(normalizedPassword, user.password);
  if (!isMatch) throw new HttpError(400, 'Invalid username or password');

  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login successful!',
    userId: user._id,
    username: user.username,
    role: user.role,
    token   // 👈 send this to frontend
  });
}));

// ------------------ Planning ------------------
app.post('/plan', requireAuth, withRoute((req, res) => {
  const { stacks, goalChain, plannerOptions, options } = req.body || {};

  const validatedStacks = validateStacksPayload(stacks);
  const validatedGoalChain = validateGoalChain(goalChain);
  const mergedOptions = sanitizePlannerOptions({ ...options, ...plannerOptions });
  const plan = planBlocksWorld(validatedStacks, validatedGoalChain, mergedOptions);

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
}));

// ------------------ Health ------------------
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.status(200).json(healthcheck);
});

app.use('/admin', adminRoutes);

app.use(express.static(path.join(__dirname, "../public")));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: ${MONGODB_URI}`);
});

mongoose.connection.once('open', async () => {
  try {
    await ensureDefaultAdmin();
  } catch (e) {
    console.error('ensureDefaultAdmin error:', e);
  }
});

// Graceful shutdown
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
