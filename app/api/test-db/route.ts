import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    await dbConnect();
    const isConnected = mongoose.connection.readyState === 1;
    
    return NextResponse.json({
      status: 'success',
      connected: isConnected,
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.name,
    });
  } catch (error) {
    console.error('MongoDB connection test error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to connect to MongoDB',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 