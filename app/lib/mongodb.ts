import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/galed-run';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

async function dbConnect() {
  try {
    if (mongoose.connection.readyState >= 1) {
      return;
    }

    return await mongoose.connect(MONGODB_URI);
  } catch (error) {
    throw new Error('Failed to connect to MongoDB');
  }
}

export default dbConnect; 