import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';
import { Team } from '../../../models/Team';
import Route, { RouteSchema } from '../../../models/Route';
import Point, { PointSchema } from '../../../models/Point';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { teamId, pointId } = await request.json();

    // Find team first by ID, then by uniqueLink
    let team = null;
    let searchId = teamId;
    
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
    } catch (err) {
      console.error('Error searching by ID:', err);
    }

    if (!team) {
      // Remove @ from the beginning if it exists
      if (searchId.startsWith('@')) {
        searchId = searchId.substring(1);
      }
      
      // Check if the teamId is a full URL
      if (searchId.includes('/game/')) {
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1];
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
    }

    if (!team) {
      return NextResponse.json({ 
        message: 'קבוצה לא נמצאה'
      }, { status: 404 });
    }

    // Validate that the team has a route and points
    if (!team.currentRoute || !team.currentRoute.points || team.currentRoute.points.length === 0) {
      console.error('Team has no route or points');
      return NextResponse.json({ message: 'שגיאה בטעינת המסלול' }, { status: 500 });
    }

    // Validate current point index
    if (team.currentPointIndex < 0 || team.currentPointIndex >= team.currentRoute.points.length) {
      console.error('Current point index out of bounds:', team.currentPointIndex);
      return NextResponse.json({ message: 'שגיאה בטעינת הנקודה' }, { status: 500 });
    }

    // Get the current point from the route
    const currentPoint = team.currentRoute.points[team.currentPointIndex];
    if (!currentPoint) {
      console.error('Current point not found');
      return NextResponse.json({ message: 'שגיאה בטעינת הנקודה' }, { status: 500 });
    }

    // Verify this is the correct point
    if (currentPoint._id.toString() !== pointId) {
      console.error('Point ID mismatch. Expected:', currentPoint._id.toString(), 'Got:', pointId);
      return NextResponse.json({ message: 'זו לא הנקודה הנוכחית במסלול' }, { status: 400 });
    }

    // Check if point was already visited (meaning the question was answered correctly)
    const pointAlreadyVisited = team.visitedPoints.some(
      visitedPointId => visitedPointId.toString() === pointId
    );

    // If the point was already visited (answered correctly), increment the index
    const updateResult = await Team.findByIdAndUpdate(
      team._id,
      pointAlreadyVisited ? 
        { $inc: { currentPointIndex: 1 } } :
        {},
      { new: true }
    ).populate({
      path: 'currentRoute',
      populate: {
        path: 'points',
        model: 'Point'
      }
    });
    
    console.log('Update result for reaching point:', updateResult);

    return NextResponse.json({ 
      success: true,
      message: pointAlreadyVisited ? 'עוברים לנקודה הבאה' : 'הנקודה עודכנה בהצלחה',
      team: updateResult
    });
  } catch (error) {
    console.error('Error updating point:', error);
    return NextResponse.json(
      { message: 'שגיאה בעדכון הנקודה' },
      { status: 500 }
    );
  }
} 