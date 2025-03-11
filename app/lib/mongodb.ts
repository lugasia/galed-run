import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Ensure the URI has the database name
let uri = MONGODB_URI;
if (!uri.includes('/galed-run?')) {
  uri = uri.replace('/?', '/galed-run?');
}

async function dbConnect() {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log('Using existing MongoDB connection');
      return;
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('Using URI with database:', uri.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://[hidden]:[hidden]@'));
    
    const connection = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
    
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    console.log('Initial connection successful');
    console.log('Database name:', connection.connection.name);
    console.log('Connection state:', connection.connection.readyState);
    
    return connection;
  } catch (error) {
    console.error('MongoDB connection error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      uri: uri.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://[hidden]:[hidden]@')
    });
    throw error;
  }
}

export default dbConnect; 