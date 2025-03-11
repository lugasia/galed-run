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
      console.log('Error searching by ID:', err);
    }

    if (!team) {
      console.log('Team not found by ID, searching by uniqueLink...');
      team = await (Team as Model<TeamWithRoute>).findOne({
        uniqueLink: teamId
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
      return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
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
      const nextPoint = team.currentRoute.points[team.currentPointIndex + 1];
      return NextResponse.json({ 
        correct: true,
        message: 'צדקת! רוץ לנקודה הבאה',
        nextPoint: {
          name: nextPoint.name,
          code: nextPoint.code
        }
      });
    }
  } catch (error) {
    console.error('Error processing answer:', error);
    return NextResponse.json(
      { message: 'שגיאה בעיבוד התשובה' },
      { status: 500 }
    );
  }
} 