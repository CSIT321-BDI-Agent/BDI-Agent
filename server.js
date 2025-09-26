// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { planBlocksWorld, PlanningError } = require('./bdi/blocksWorldAgent');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blocks_world';

const path = require("path");

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

// Enhanced MongoDB connection with retry logic for Docker
const connectDB = async () => {
  const maxRetries = 5;
  const retryDelay = 5000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB connected successfully (attempt ${attempt})`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('💀 All MongoDB connection attempts failed. Exiting...');
        process.exit(1);
      }
      
      console.log(`⏳ Retrying MongoDB connection in ${retryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
};

// Initialize database connection
connectDB();

const WorldSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  blocks: { type: [String], required: true },
  stacks: { type: [[String]], required: true },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });


const World = mongoose.model('World', WorldSchema);

app.post('/worlds', async (req, res) => {
  try {
    const { name, blocks, stacks, userId } = req.body;
    
    // Enhanced validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Valid world name is required' });
    }
    if (!Array.isArray(blocks) || !Array.isArray(stacks)) {
      return res.status(400).json({ message: 'Blocks and stacks must be arrays' });
    }
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const world = await World.create({ 
      name: name.trim(), 
      blocks, 
      stacks, 
      user: new mongoose.Types.ObjectId(userId)
    });
    res.status(201).json(world);
  } catch (e) {
    console.error('❌ Error saving world:', e);
    if (e.name === 'ValidationError') {
      res.status(400).json({ message: 'Invalid world data provided' });
    } else {
      res.status(500).json({ message: 'Failed to save world' });
    }
  }
});

app.get('/worlds', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }

  try {
    const worlds = await World.find({ user: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
    res.json(worlds);
  } catch (e) {
    console.error('❌ Error fetching worlds:', e);
    res.status(500).json({ message: 'Failed to fetch worlds' });
  }
});

app.get('/worlds/:id', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "userId required" });

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  try {
    const doc = await World.findOne({ 
      _id: new mongoose.Types.ObjectId(req.params.id), 
      user: new mongoose.Types.ObjectId(userId) 
    });
    if (!doc) return res.status(404).json({ message: 'World not found or access denied' });
    res.json(doc);
  } catch (e) {
    console.error('Error fetching world:', e);
    if (e.name === 'CastError') {
      res.status(400).json({ message: 'Invalid world ID format' });
    } else {
      res.status(500).json({ message: 'Failed to fetch world' });
    }
  }
});

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true } 
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Signup route
app.post('/users/signup', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Enhanced validation
    if (!email || !username || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    // Username validation
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ message: 'Username must be between 3 and 20 characters' });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      const field = exists.email === email ? 'Email' : 'Username';
      return res.status(400).json({ message: `${field} already exists` });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({ 
      email: email.toLowerCase().trim(), 
      username: username.trim(), 
      password: hashedPassword 
    });
    
    res.status(201).json({ 
      message: 'User created successfully', 
      userId: newUser._id 
    });

  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === 11000) {
      const field = err.keyPattern.email ? 'Email' : 'Username';
      res.status(400).json({ message: `${field} already exists` });
    } else {
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: "Invalid input format" });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Send userId back to client
    res.json({ 
      message: "Login successful!", 
      userId: user._id,
      username: user.username 
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "Server error during login" });
  }
});

app.post('/plan', (req, res) => {
  try {
    const { stacks, goalChain, plannerOptions, options } = req.body || {};

    const mergedOptions = plannerOptions || options || {};
    const plan = planBlocksWorld(stacks, goalChain, mergedOptions);

    res.json({
      moves: plan.moves,
      iterations: plan.iterations,
      goalAchieved: plan.goalAchieved,
      relationsResolved: plan.relationsResolved,
      agentCount: plan.agentCount,
      intentionLog: plan.intentionLog || []
    });
  } catch (error) {
    const status = error instanceof PlanningError ? error.status : 500;
    console.error('Plan computation error:', error);
    res.status(status).json({
      message: error.message || 'Failed to compute plan'
    });
  }
});

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
