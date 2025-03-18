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

    // Update visited points and current point index
    const updateResult = await Team.updateOne(
      { _id: team._id },
      { 
        $push: { visitedPoints: pointId },
        $inc: { currentPointIndex: 1 }
      }
    ).exec();
    
    console.log('Update result for reaching point:', updateResult);

    // Get updated team data
    const updatedTeam = await Team.findById(team._id).populate({
      path: 'currentRoute',
      populate: {
        path: 'points',
        model: 'Point'
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'הנקודה עודכנה בהצלחה',
      team: updatedTeam
    });
  } catch (error) {
    console.error('Error updating point:', error);
    return NextResponse.json(
      { message: 'שגיאה בעדכון הנקודה' },
      { status: 500 }
    );
  }
} 