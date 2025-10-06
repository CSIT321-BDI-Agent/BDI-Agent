// MongoDB connection management with Docker-ready retry logic
const mongoose = require('mongoose');

const connectDB = async (uri, maxRetries = 5, retryDelay = 5000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
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

module.exports = { connectDB };
