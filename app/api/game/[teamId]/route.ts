import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import Route, { RouteSchema } from '../../../models/Route';
import Point, { PointSchema } from '../../../models/Point';
import mongoose, { Model } from 'mongoose';

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
    
    console.log('Searching for team with ID/uniqueLink:', params.teamId);
    
    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }
    
    // Try to find team by ID first
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(params.teamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await (Team as Model<ITeam>).findById(params.teamId)
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
      console.log('Error searching by ID:', err);
    }

    if (!team) {
      console.log('Team not found by ID, searching by uniqueLink...');
      
      // Extract the teamId from the full URL if it's a full URL
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
      
      // First try to find by exact uniqueLink match
      team = await (Team as Model<ITeam>).findOne({
        uniqueLink: params.teamId
      }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      
      // If not found, try to find by uniqueLink that ends with the teamId
      if (!team) {
        console.log('Team not found by exact uniqueLink, trying to find by URL ending with teamId...');
        team = await (Team as Model<ITeam>).findOne({
          uniqueLink: { $regex: searchId + '$' }
        }).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
      
      if (team) {
        console.log('Team found by uniqueLink');
      } else {
        console.log('Team not found by uniqueLink either');
      }
    }

    if (!team) {
      console.log('No team found with ID/uniqueLink:', params.teamId);
      return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
    }

    // Log the found team details (without sensitive info)
    console.log('Found team:', {
      id: team._id,
      name: team.name,
      uniqueLink: team.uniqueLink,
      hasCurrentRoute: !!team.currentRoute,
      startTime: team.startTime,
      penaltyEndTime: team.penaltyEndTime
    });

    // If the team has no startTime but the user is accessing the game page,
    // we should set the startTime to ensure the team appears in the admin panel
    if (!team.startTime) {
      console.log('Team has no startTime, setting it now');
      team.startTime = new Date();
      team.active = true;
      
      // Set initial location to the first point in the route if available
      if (team.currentRoute && team.currentRoute.points && team.currentRoute.points.length > 0) {
        const firstPoint = team.currentRoute.points[0];
        team.currentLocation = {
          type: 'Point',
          coordinates: firstPoint.location,
          timestamp: new Date()
        };
      }
      
      await team.save();
      console.log('Team updated with startTime and location');
    }

    return NextResponse.json({ team: JSON.parse(JSON.stringify(team)) });
  } catch (error) {
    console.error('Error in GET /api/game/[teamId]:', error);
    return NextResponse.json(
      { message: 'שגיאה בטעינת נתוני הקבוצה' },
      { status: 500 }
    );
  }
} 