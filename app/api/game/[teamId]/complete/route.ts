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
    console.log('Received completion request for teamId:', params.teamId);
    await dbConnect();
    const data = await request.json();
    console.log('Completion data:', data);
    
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
      console.log('Searching by ID:', searchId);
      team = await Team.findById(searchId).populate('currentRoute');
      if (team) console.log('Found team by ID');
    }
    
    // If not found, try to find by uniqueLink
    if (!team) {
      console.log('Searching by uniqueLink pattern:', searchId);
      team = await Team.findOne({
        uniqueLink: { $regex: searchId + '$' }
      }).populate('currentRoute');
      if (team) console.log('Found team by uniqueLink');
    }
    
    if (!team) {
      console.log('Team not found');
      return NextResponse.json({ 
        error: 'Team not found',
        debug: { searchId, originalId: params.teamId }
      }, { status: 404 });
    }
    
    console.log('Found team:', {
      id: team._id,
      name: team.name,
      uniqueLink: team.uniqueLink
    });
    
    // Update team with completion data
    const updates = {
      completionTime: data.completionTime,
      completedAt: new Date(),
      active: false
    };
    
    console.log('Updating team with:', updates);
    
    // Use findByIdAndUpdate to ensure atomic update
    const updatedTeam = await Team.findByIdAndUpdate(
      team._id,
      { $set: updates },
      { new: true }
    );
    
    if (!updatedTeam) {
      console.log('Failed to update team');
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
    
    console.log('Team updated successfully');
    
    // Create completion event
    try {
      const event = await Event.create({
        team: team._id,
        type: 'ROUTE_COMPLETED',
        route: team.currentRoute._id,
        details: {
          finalTime: data.finalTime,
          completedAt: data.completedAt
        }
      });
      console.log('Created completion event:', event._id);
    } catch (eventError) {
      console.error('Failed to create completion event:', eventError);
      // Continue even if event creation fails
    }
    
    return NextResponse.json({ 
      success: true,
      debug: {
        teamId: team._id,
        completionTime: data.completionTime
      }
    });
  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json(
      { 
        error: 'Failed to complete game',
        debug: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 