// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');


const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blocks_world';

const path = require("path");

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with actual production domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

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

    const world = await World.create({ 
      name: name.trim(), 
      blocks, 
      stacks, 
      user: userId 
    });
    res.status(201).json(world);
  } catch (e) {
    console.error('Error saving world:', e);
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

  try {
    const worlds = await World.find({ user: userId }).sort({ createdAt: -1 });
    res.json(worlds);
  } catch (e) {
    console.error('Error fetching worlds:', e);
    res.status(500).json({ message: 'Failed to fetch worlds' });
  }
});

app.get('/worlds/:id', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "userId required" });

  try {
    const doc = await World.findOne({ _id: req.params.id, user: userId });
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


app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
