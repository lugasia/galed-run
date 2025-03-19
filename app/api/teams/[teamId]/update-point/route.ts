import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import mongoose from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
    
    const { teamId } = params;
    const { currentPointIndex } = await request.json();
    
    // Validate input
    if (currentPointIndex === undefined || currentPointIndex === null) {
      return NextResponse.json(
        { success: false, message: 'Missing currentPointIndex' },
        { status: 400 }
      );
    }
    
    // Find and update team by ID or unique link
    const db = mongoose.connection.db;
    const result = await db.collection('teams').findOneAndUpdate(
      {
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(teamId) ? new mongoose.Types.ObjectId(teamId) : null },
          { uniqueLink: { $regex: teamId, $options: 'i' } }
        ]
      },
      { $set: { currentPointIndex: currentPointIndex } },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Team not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Current point index updated successfully',
      currentPointIndex
    });
  } catch (error) {
    console.error('Error updating point index:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 