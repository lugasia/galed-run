import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import mongoose, { Model } from 'mongoose';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { teamId, coordinates } = await request.json();

    const team = await (Team as Model<ITeam>).findOne({ 
      uniqueLink: { $regex: teamId }
    });
    
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    team.currentLocation = {
      type: 'Point',
      coordinates: coordinates as [number, number],
      timestamp: new Date()
    };

    await team.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating team location:', error);
    return NextResponse.json(
      { error: 'Failed to update team location' },
      { status: 500 }
    );
  }
} 