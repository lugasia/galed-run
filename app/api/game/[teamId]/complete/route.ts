import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import mongoose from 'mongoose';
import { Team } from '../../../../models/Team';
import Event from '../../../../models/Event';

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Find team by ID or uniqueLink
    let team;
    let searchId = params.teamId;
    
    // Remove @ from the beginning if it exists
    if (searchId.startsWith('@')) {
      searchId = searchId.substring(1);
    }
    
    // Check if the teamId is a full URL
    if (searchId.includes('/game/')) {
      // Extract the last part of the URL (the actual teamId)
      const urlParts = searchId.split('/');
      searchId = urlParts[urlParts.length - 1];
      console.log('Extracted teamId from URL:', searchId);
    }
    
    // First try to find by ID
    if (mongoose.Types.ObjectId.isValid(searchId)) {
      team = await Team.findById(searchId);
    }
    
    // If not found, try to find by uniqueLink
    if (!team) {
      team = await Team.findOne({
        uniqueLink: { $regex: searchId + '$' }
      });
    }
    
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    // Update team with completion data
    team.completionTime = data.completionTime;
    team.completedAt = new Date();
    team.active = false;
    await team.save();
    
    // Create completion event
    await Event.create({
      team: team._id,
      type: 'ROUTE_COMPLETED',
      route: team.currentRoute,
      details: {
        finalTime: data.finalTime,
        completedAt: data.completedAt
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json(
      { error: 'Failed to complete game' },
      { status: 500 }
    );
  }
} 