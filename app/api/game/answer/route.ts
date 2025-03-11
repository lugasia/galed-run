import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose, { Document, Model } from 'mongoose';
import { Team, ITeam } from '../../../models/Team';
import Route, { RouteSchema } from '../../../models/Route';
import Point, { PointSchema } from '../../../models/Point';
import { Route as RouteType } from '../../../types';

interface RouteWithSettings {
  _id: mongoose.Types.ObjectId;
  name: string;
  points: any[];
  settings?: {
    penaltyTime: number;
    maxAttempts: number;
  };
}

interface TeamWithRoute extends Omit<ITeam, 'currentRoute'> {
  currentRoute: RouteWithSettings;
}

// Helper function to request a hint automatically
async function requestAutomaticHint(teamId: string, pointId: string, hintLevel: number) {
  try {
    const hintResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/game/hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        teamId,
        pointId,
        hintLevel,
        isAutomatic: true
      }),
    });
    
    const hintData = await hintResponse.json();
    console.log('Automatic hint requested:', hintData);
    return hintData;
  } catch (error) {
    console.error('Error requesting automatic hint:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { teamId, pointId, answer } = await request.json();

    console.log('Processing answer for teamId:', teamId);
    
    // Make sure models are registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }
    
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    // Find team first by ID, then by uniqueLink
    let team: TeamWithRoute | null = null;
    let searchId = teamId; // Declare searchId at the top level
    
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await (Team as Model<TeamWithRoute>).findById(teamId)
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
        // Extract the last part of the URL (the actual teamId)
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1];
        console.log('Extracted teamId from URL:', searchId);
      }
      
      // First try to find by exact uniqueLink match
      team = await (Team as Model<TeamWithRoute>).findOne({
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
      } else {
        console.log('Team not found by uniqueLink either');
      }
    }

    if (!team) {
      console.log('No team found with ID/uniqueLink:', teamId);
      return NextResponse.json({ 
        message: 'קבוצה לא נמצאה',
        debug: {
          originalTeamId: teamId,
          searchId: searchId
        }
      }, { status: 404 });
    }

    // Check if team has already completed the route
    if (team.currentPointIndex >= team.currentRoute.points.length) {
      return NextResponse.json({ 
        correct: true,
        message: 'כל הכבוד! סיימתם את המסלול',
        isLastPoint: true
      });
    }

    const point = team.currentRoute.points[team.currentPointIndex];
    if (!point || point._id.toString() !== pointId) {
      return NextResponse.json({ message: 'נקודה לא נמצאה' }, { status: 404 });
    }

    const correct = point.question.correctAnswer === answer;

    // Create event for the answer
    await mongoose.models.Event.create({
      team: team._id,
      type: 'QUESTION_ANSWERED',
      point: pointId,
      route: team.currentRoute._id,
      details: {
        answer,
        correct,
        attempt: team.attempts || 1
      },
    });

    if (!correct) {
      // First check if we're about to reach the second attempt
      const currentTeams = await (Team as Model<TeamWithRoute>).find(
        { _id: team._id }
      )
      .populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      })
      .limit(1)
      .exec();

      const currentTeam = currentTeams[0];
      if (!currentTeam) {
        return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
      }

      console.log('Current attempts before increment:', currentTeam.attempts); // Debug log
      const attempts = (currentTeam.attempts || 0) + 1;
      
      // New game flow logic:
      // 1. First attempt - if wrong, no penalty
      // 2. Second attempt - if wrong, apply penalty and then show zoom out image (hint level 1)
      // 3. After penalty, player gets one more attempt with zoom out image
      // 4. If wrong again, apply penalty and then move to next point
      
      // Check if this is the second attempt (after first wrong answer)
      if (attempts === 2) {
        const penaltyMinutes = currentTeam.currentRoute.settings?.penaltyTime || 2;
        const penaltyTime = penaltyMinutes * 60 * 1000; // Convert minutes to milliseconds
        
        // Apply penalty and set hint level to 1 (zoom out) after penalty
        await (Team as Model<TeamWithRoute>).updateOne(
          { _id: team._id },
          { 
            $set: { 
              penaltyEndTime: new Date(Date.now() + penaltyTime),
              attempts: attempts
            }
          }
        ).exec();

        // Request hint level 1 (zoom out) to be shown after penalty
        await requestAutomaticHint(teamId, pointId, 1);

        return NextResponse.json({
          correct: false,
          message: 'טעית, המתן לזמן העונשין',
          penaltyEndTime: new Date(Date.now() + penaltyTime).toISOString(),
          attempts: attempts,
          hintRequested: true,
          hintLevel: 1
        });
      }
      // Check if this is the third attempt (after penalty, with zoom out image)
      else if (attempts === 3) {
        const penaltyMinutes = currentTeam.currentRoute.settings?.penaltyTime || 2;
        const penaltyTime = penaltyMinutes * 60 * 1000; // Convert minutes to milliseconds
        
        // Apply penalty and move to next point after penalty
        await (Team as Model<TeamWithRoute>).updateOne(
          { _id: team._id },
          { 
            $set: { 
              penaltyEndTime: new Date(Date.now() + penaltyTime),
              attempts: 0 // Reset attempts for next point
            },
            $inc: { currentPointIndex: 1 } // Move to next point
          }
        ).exec();

        return NextResponse.json({
          correct: false,
          message: 'טעית, המתן לזמן העונשין ואז רוץ לנקודה הבאה',
          penaltyEndTime: new Date(Date.now() + penaltyTime).toISOString(),
          attempts: attempts
        });
      }
      // First attempt - just increment attempts
      else {
        // Increment the attempts counter
        await (Team as Model<TeamWithRoute>).updateOne(
          { _id: team._id },
          { $inc: { attempts: 1 } }
        ).exec();

        console.log('Updated team attempts:', attempts); // Debug log
        
        return NextResponse.json({
          correct: false,
          message: 'טעית, נסה שוב',
          attempts
        });
      }
    }

    // On correct answer:
    // 1. Reset attempts counter
    // 2. Add point to visited points
    // 3. Increment current point index
    await (Team as Model<TeamWithRoute>).updateOne(
      { _id: team._id },
      { 
        $set: { attempts: 0 },
        $push: { visitedPoints: pointId },
        $inc: { currentPointIndex: 1 }
      }
    ).exec();

    // Check if this was the last point
    const isLastPoint = team.currentPointIndex === team.currentRoute.points.length - 1;
    if (isLastPoint) {
      await mongoose.models.Event.create({
        team: team._id,
        type: 'ROUTE_COMPLETED',
        route: team.currentRoute._id,
      });

      return NextResponse.json({ 
        correct: true,
        message: 'כל הכבוד! סיימתם את המסלול',
        isLastPoint: true
      });
    } else {
      // Get next point info
      try {
        // Fetch the team again to get the updated currentPointIndex
        const updatedTeam = await (Team as Model<TeamWithRoute>).findById(team._id)
          .populate({
            path: 'currentRoute',
            populate: {
              path: 'points',
              model: 'Point'
            }
          });
        
        if (!updatedTeam) {
          console.error('Could not find team after updating currentPointIndex');
          return NextResponse.json({ 
            correct: true,
            message: 'צדקת! רוץ לנקודה הבאה'
          });
        }
        
        // Use the updated team's currentPointIndex
        const nextPointIndex = updatedTeam.currentPointIndex;
        console.log('Next point index:', nextPointIndex);
        console.log('Route points length:', updatedTeam.currentRoute?.points?.length || 0);
        console.log('Team data:', {
          id: updatedTeam._id,
          name: updatedTeam.name,
          currentPointIndex: updatedTeam.currentPointIndex,
          routeId: updatedTeam.currentRoute?._id,
          routeName: updatedTeam.currentRoute?.name
        });
        
        // Make sure the next point exists
        if (!updatedTeam.currentRoute || !updatedTeam.currentRoute.points) {
          console.error('Team has no route or points array is missing');
          return NextResponse.json({ 
            correct: true,
            message: 'צדקת! רוץ לנקודה הבאה'
          });
        }
        
        if (nextPointIndex >= updatedTeam.currentRoute.points.length) {
          console.error('Next point index out of bounds:', nextPointIndex, 'points length:', updatedTeam.currentRoute.points.length);
          return NextResponse.json({ 
            correct: true,
            message: 'צדקת! רוץ לנקודה הבאה'
          });
        }
        
        const nextPoint = updatedTeam.currentRoute.points[nextPointIndex];
        console.log('Next point:', nextPoint ? {
          id: nextPoint._id,
          name: nextPoint.name,
          code: nextPoint.code
        } : 'undefined');
        
        if (!nextPoint) {
          console.error('Next point is undefined');
          return NextResponse.json({ 
            correct: true,
            message: 'צדקת! רוץ לנקודה הבאה'
          });
        }
        
        return NextResponse.json({ 
          correct: true,
          message: 'צדקת! רוץ לנקודה הבאה',
          nextPoint: {
            name: nextPoint.name,
            code: nextPoint.code,
            isFinishPoint: nextPoint.isFinishPoint || nextPoint.code === '1011'
          }
        });
      } catch (nextPointError) {
        console.error('Error getting next point:', nextPointError);
        // Return a simpler response if we can't get the next point
        return NextResponse.json({ 
          correct: true,
          message: 'צדקת! רוץ לנקודה הבאה'
        });
      }
    }
  } catch (error) {
    console.error('Error processing answer:', error);
    return NextResponse.json(
      { message: 'שגיאה בעיבוד התשובה' },
      { status: 500 }
    );
  }
} 