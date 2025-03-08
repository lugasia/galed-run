import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import Route from '../../../models/Route';
import Point from '../../../models/Point';
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
      mongoose.model('Route', Route.schema);
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
      // If not found by ID, try to find by uniqueLink
      team = await (Team as Model<ITeam>).findOne({
        uniqueLink: params.teamId
      }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      
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
      penaltyEndTime: team.penaltyEndTime
    });

    return NextResponse.json({ team: JSON.parse(JSON.stringify(team)) });
  } catch (error) {
    console.error('Error in GET /api/game/[teamId]:', error);
    return NextResponse.json(
      { message: 'שגיאה בטעינת נתוני הקבוצה' },
      { status: 500 }
    );
  }
} 