import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    console.log('Starting MongoDB connection test...');
    
    // Test basic connection
    await dbConnect();
    
    // Test basic write operation
    const testCollection = mongoose.connection.collection('test');
    const testDoc = { test: true, timestamp: new Date() };
    await testCollection.insertOne(testDoc);
    console.log('Successfully wrote test document');
    
    // Test read operation
    const readResult = await testCollection.findOne({ test: true });
    console.log('Successfully read test document:', readResult);
    
    // Clean up
    await testCollection.deleteOne({ test: true });
    console.log('Successfully cleaned up test document');

    return NextResponse.json({ 
      status: 'success',
      details: {
        connected: mongoose.connection.readyState === 1,
        database: mongoose.connection.name,
        host: mongoose.connection.host
      }
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json(
      { 
        error: 'Database test failed',
        details: {
          message: error.message,
          name: error.name,
          code: error.code,
          connectionState: mongoose.connection.readyState
        }
      },
      { status: 500 }
    );
  }
} 