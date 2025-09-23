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


app.use(cors());
app.use(express.json());

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
    if (!name || !Array.isArray(blocks) || !Array.isArray(stacks) || !userId) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const saved = await World.create({ name, blocks, stacks, user: userId });
    res.status(201).json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to save world' });
  }
});


app.post('/worlds', async (req, res) => {
  const { name, blocks, stacks, userId } = req.body;  // userId must be passed
  if (!userId) return res.status(400).json({ message: 'userId required' });

  try {
    const world = await World.create({ name, blocks, stacks, userId }); // store userId
    res.status(201).json(world);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to save world' });
  }
});



app.get('/worlds/:id', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "userId required" });

  try {
    const doc = await World.findOne({ _id: req.params.id, userId }); // <-- use userId
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch world' });
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
    if (!email || !username || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ message: 'Email or username already exists' });

    const salt = await bcrypt.genSalt(10);
	const hashedPassword = await bcrypt.hash(password, salt);

	const newUser = await User.create({ email, username, password: hashedPassword });
	res.status(201).json({ message: 'User created', userId: newUser._id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Account does not exist." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password." });

    // Send userId back to client
    res.json({ message: "Login successful!", userId: user._id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});


app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
