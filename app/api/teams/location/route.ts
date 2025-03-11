import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import mongoose, { Model } from 'mongoose';
import Point, { PointSchema } from '../../../models/Point';
import Route, { RouteSchema } from '../../../models/Route';

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }
    
    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }

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