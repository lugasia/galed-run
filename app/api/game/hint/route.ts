import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import { Team, ITeam } from '../../../models/Team';
import Route, { RouteSchema } from '../../../models/Route';
import Point, { PointSchema } from '../../../models/Point';
import Event from '../../../models/Event';

// קבוע לזמן העונשין עבור רמז (בדקות)
const HINT_PENALTY_TIME = 1;

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Make sure models are registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }
    
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    const { teamId, pointIndex, hintLevel, isAutomatic = false } = await request.json();

    console.log('Processing hint request for teamId:', teamId, 'pointIndex:', pointIndex, 'hintLevel:', hintLevel, 'isAutomatic:', isAutomatic);
    
    // Find team first by ID, then by uniqueLink
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await (Team as Model<ITeam>).findById(teamId)
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
      let searchId = teamId;
      
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
        uniqueLink: teamId
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
      console.log('No team found with ID/uniqueLink:', teamId);
      return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
    }

    // Check if the team is in a penalty period - skip this check for automatic hints
    if (!isAutomatic && team.penaltyEndTime && new Date(team.penaltyEndTime) > new Date()) {
      return NextResponse.json({ 
        message: 'לא ניתן לבקש רמז בזמן עונשין',
      }, { status: 400 });
    }

    // Check if the requested point index matches the team's current point index
    if (pointIndex !== team.currentPointIndex) {
      return NextResponse.json({ 
        message: 'מספר הנקודה אינו תואם את הנקודה הנוכחית',
      }, { status: 400 });
    }

    // Check if the hint level is valid (1 or 2)
    if (hintLevel < 1 || hintLevel > 2) {
      return NextResponse.json({ 
        message: 'רמת הרמז אינה תקינה',
      }, { status: 400 });
    }

    // Check if the team already has a hint at this level or higher - skip this check for automatic hints
    if (!isAutomatic && team.hintRequested && 
        team.hintRequested.pointIndex === pointIndex && 
        team.hintRequested.hintLevel >= hintLevel) {
      return NextResponse.json({ 
        message: 'כבר קיבלת רמז ברמה זו או גבוהה יותר',
      }, { status: 400 });
    }

    // Apply penalty time
    const now = new Date();
    const penaltyEndTime = new Date(now.getTime() + HINT_PENALTY_TIME * 60 * 1000); // Convert minutes to milliseconds
    
    // Update the team with the hint request and penalty
    team.hintRequested = {
      pointIndex,
      hintLevel,
      timestamp: now
    };
    team.penaltyEndTime = penaltyEndTime;
    
    await team.save();
    
    // Create an event for the hint request
    await Event.create({
      team: team._id,
      type: 'HINT_REQUESTED',
      details: {
        pointIndex,
        hintLevel,
        penaltyTime: HINT_PENALTY_TIME,
        isAutomatic
      }
    });

    return NextResponse.json({
      message: 'רמז התקבל בהצלחה',
      hintLevel,
      penaltyEndTime
    });
  } catch (error) {
    console.error('Error processing hint request:', error);
    return NextResponse.json(
      { message: 'שגיאה בבקשת רמז' },
      { status: 500 }
    );
  }
} 