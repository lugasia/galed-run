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

    // Find team first by ID, then by uniqueLink
    let team = null;
    let searchId = cleanedTeamId;
    
    try {
      if (mongoose.Types.ObjectId.isValid(cleanedTeamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await Team.findById(cleanedTeamId)
          .populate({
            path: 'currentRoute',
            populate: {
              path: 'points',
              model: 'Point'
            }
          });
        if (team) {
          console.log('Team found by ID');
        }
      }
    } catch (err) {
      console.error('Error searching by ID:', err);
    }

    if (!team) {
      console.log('Team not found by ID, searching by uniqueLink...');
      
      // Remove @ from the beginning if it exists
      if (searchId.startsWith('@')) {
        searchId = searchId.substring(1);
      }
      
      // Check if the teamId is a full URL
      if (searchId.includes('/game/')) {
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1];
        console.log('Extracted teamId from URL:', searchId);
      }
      
      team = await Team.findOne({
        uniqueLink: { $regex: searchId + '$' }
      }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      
      if (team) {
        console.log('Team found by uniqueLink');
        
        // Validate team data
        if (!team.currentRoute) {
          console.error('Team found but has no route:', team._id);
          return NextResponse.json({ message: 'שגיאה בטעינת המסלול' }, { status: 500 });
        }
        
        if (!team.currentRoute.points || team.currentRoute.points.length === 0) {
          console.error('Team route has no points:', team.currentRoute._id);
          return NextResponse.json({ message: 'שגיאה בטעינת הנקודות' }, { status: 500 });
        }
        
        // Fix currentPointIndex if it's out of bounds
        if (team.currentPointIndex >= team.currentRoute.points.length) {
          console.log('Fixing out of bounds currentPointIndex:', team.currentPointIndex, 'to', team.currentRoute.points.length - 1);
          team.currentPointIndex = team.currentRoute.points.length - 1;
          await team.save();
        }
        
        console.log('Team data validated successfully');
      } else {
        console.log('Team not found by uniqueLink either');
      }
    }

    return NextResponse.json({ 
      team,
      debug: {
        originalTeamId: params.teamId,
        cleanedTeamId: cleanedTeamId,
        searchId: searchId,
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