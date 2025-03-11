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
    
    // Clean and normalize the teamId
    let cleanTeamId = params.teamId;
    
    // Remove any URL parameters if present
    if (cleanTeamId.includes('?')) {
      cleanTeamId = cleanTeamId.split('?')[0];
    }
    
    // Remove trailing slashes
    cleanTeamId = cleanTeamId.replace(/\/+$/, '');
    
    // Remove @ from the beginning if it exists
    if (cleanTeamId.startsWith('@')) {
      cleanTeamId = cleanTeamId.substring(1);
    }
    
    // Extract the teamId from the full URL if it's a full URL
    let searchId = cleanTeamId;
    
    // Check if the teamId is a full URL
    if (searchId.includes('/game/')) {
      // Extract the last part of the URL (the actual teamId)
      const urlParts = searchId.split('/');
      searchId = urlParts[urlParts.length - 1];
      console.log('Extracted teamId from URL:', searchId);
    }
    
    console.log('Using cleaned teamId:', cleanTeamId);
    console.log('Using searchId:', searchId);
    
    // Try to find team by ID first
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(cleanTeamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await (Team as Model<ITeam>).findById(cleanTeamId)
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

    // If not found by ID, try by uniqueLink
    if (!team) {
      console.log('Team not found by ID, searching by uniqueLink...');
      
      // Try multiple search strategies
      
      // 1. First try to find by exact uniqueLink match with cleaned teamId
      team = await (Team as Model<ITeam>).findOne({
        uniqueLink: cleanTeamId
      }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      
      // 2. If not found, try to find by extracted searchId
      if (!team && searchId !== cleanTeamId) {
        console.log('Trying with extracted searchId:', searchId);
        team = await (Team as Model<ITeam>).findOne({
          uniqueLink: searchId
        }).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
      
      // 3. If not found, try to find by uniqueLink that ends with the teamId
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
      
      // 4. If not found, try to find by uniqueLink that contains the teamId
      if (!team) {
        console.log('Trying to find by uniqueLink containing teamId...');
        team = await (Team as Model<ITeam>).findOne({
          uniqueLink: { $regex: searchId, $options: 'i' }
        }).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
      
      // 5. Last resort: try to find any team with this name
      if (!team) {
        console.log('Trying to find by team name...');
        team = await (Team as Model<ITeam>).findOne({
          name: { $regex: searchId, $options: 'i' }
        }).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
      
      // 6. Try to find any active team
      if (!team) {
        console.log('Trying to find any active team...');
        team = await (Team as Model<ITeam>).findOne({
          active: true
        }).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
      
      if (team) {
        console.log('Team found by uniqueLink or name');
      } else {
        console.log('Team not found by any method');
      }
    }

    if (!team) {
      console.log('No team found with ID/uniqueLink:', params.teamId);
      return NextResponse.json({ 
        message: 'קבוצה לא נמצאה',
        debug: {
          originalTeamId: params.teamId,
          cleanedTeamId: cleanTeamId,
          searchId: searchId
        }
      }, { status: 404 });
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

    return NextResponse.json({ 
      team: JSON.parse(JSON.stringify(team)),
      debug: {
        originalTeamId: params.teamId,
        cleanedTeamId: cleanTeamId,
        searchId: searchId
      }
    });
  } catch (error) {
    console.error('Error in GET /api/game/[teamId]:', error);
    return NextResponse.json(
      { 
        message: 'שגיאה בטעינת נתוני הקבוצה',
        error: error instanceof Error ? error.message : String(error),
        debug: {
          originalTeamId: params.teamId
        }
      },
      { status: 500 }
    );
  }
} 