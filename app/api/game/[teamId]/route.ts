import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';
import { Team } from '../../../models/Team';
import Point, { PointSchema } from '../../../models/Point';
import Route, { RouteSchema } from '../../../models/Route';

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
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

    console.log('Searching for team with ID:', params.teamId);
    
    // Clean the teamId
    const cleanedTeamId = params.teamId.replace(/[@/]/g, '');
    console.log('Cleaned teamId:', cleanedTeamId);

    // Try different methods to find the team
    let team = null;

    // 1. Try by exact ID match
    if (mongoose.Types.ObjectId.isValid(cleanedTeamId)) {
      team = await Team.findById(cleanedTeamId).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      if (team) console.log('Found team by ID');
    }

    // 2. Try by exact uniqueLink match
    if (!team) {
      team = await Team.findOne({ uniqueLink: cleanedTeamId }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      if (team) console.log('Found team by exact uniqueLink');
    }

    // 3. Try by uniqueLink ending
    if (!team) {
      team = await Team.findOne({
        uniqueLink: { $regex: cleanedTeamId + '$' }
      }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      if (team) console.log('Found team by uniqueLink ending');
    }

    // If still no team found, return debug info
    if (!team) {
      console.log('No team found with any method');
      return NextResponse.json({
        message: 'Team not found',
        debug: {
          originalTeamId: params.teamId,
          cleanedTeamId: cleanedTeamId,
          searchId: cleanedTeamId
        }
      }, { status: 404 });
    }

    return NextResponse.json({ 
      team,
      debug: {
        originalTeamId: params.teamId,
        cleanedTeamId: cleanedTeamId,
        searchId: cleanedTeamId,
        foundMethod: team ? 'success' : 'not_found'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/game/[teamId]:', error);
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 