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

// Add logic to track completion times and update messages based on rankings

// Example logic (pseudo-code):
// 1. Store completion time for each team
// 2. Compare times to determine rankings
// 3. Update messages based on rankings

// Pseudo-code implementation
const completionTimes = {}; // Store team completion times

export async function POST(request: Request) {
  let debugInfo = {
    stage: 'start',
    error: null as any,
    teamId: null as string | null,
    pointId: null as string | null,
    teamFound: false,
    hasRoute: false,
    currentPointIndex: null as number | null,
    visitedPoints: [] as string[]
  };

  try {
    debugInfo.stage = 'init';
    await dbConnect();
    const { teamId, pointId, answer } = await request.json();
    
    debugInfo.teamId = teamId;
    debugInfo.pointId = pointId;
    debugInfo.stage = 'after_parse_request';

    console.log('Processing answer request:', {
      teamId,
      pointId,
      answer,
      timestamp: new Date().toISOString()
    });
    
    // Make sure models are registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }
    
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    debugInfo.stage = 'finding_team';
    // Find team first by ID, then by uniqueLink
    let team: TeamWithRoute | null = null;
    let searchId = teamId;
    
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
      }
    } catch (err) {
      console.error('Error searching by ID:', err);
      debugInfo.error = err;
    }

    if (!team) {
      debugInfo.stage = 'searching_by_link';
      console.log('Team not found by ID, searching by uniqueLink...');
      
      if (searchId.startsWith('@')) {
        searchId = searchId.substring(1);
      }
      
      if (searchId.includes('/game/')) {
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1];
      }
      
      team = await (Team as Model<TeamWithRoute>).findOne({
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
      debugInfo.stage = 'team_not_found';
      console.error('No team found with ID/uniqueLink:', teamId);
      return NextResponse.json({ 
        message: 'קבוצה לא נמצאה',
        debug: debugInfo
      }, { status: 404 });
    }

    debugInfo.teamFound = true;
    debugInfo.hasRoute = !!team.currentRoute;
    debugInfo.currentPointIndex = team.currentPointIndex;
    debugInfo.visitedPoints = team.visitedPoints?.map(id => id.toString()) || [];
    debugInfo.stage = 'team_found';

    // Validate current point index and route
    if (!team.currentRoute || !team.currentRoute.points || team.currentRoute.points.length === 0) {
      debugInfo.stage = 'route_validation_failed';
      console.error('Team has no route or points array is empty');
      return NextResponse.json({ 
        message: 'שגיאה בטעינת הנקודה',
        debug: debugInfo
      }, { status: 500 });
    }

    if (team.currentPointIndex < 0 || team.currentPointIndex >= team.currentRoute.points.length) {
      debugInfo.stage = 'point_index_validation_failed';
      console.error('Current point index out of bounds:', team.currentPointIndex);
      return NextResponse.json({ 
        message: 'שגיאה בטעינת הנקודה',
        debug: debugInfo
      }, { status: 500 });
    }

    debugInfo.stage = 'processing_answer';
    const point = team.currentRoute.points[team.currentPointIndex];
    
    if (!point) {
      debugInfo.stage = 'point_not_found';
      console.error('Current point is undefined');
      return NextResponse.json({ 
        message: 'נקודה לא נמצאה',
        debug: debugInfo
      }, { status: 404 });
    }

    if (point._id.toString() !== pointId) {
      debugInfo.stage = 'point_id_mismatch';
      console.error('Point ID mismatch:', {
        expected: point._id.toString(),
        received: pointId,
        currentPointIndex: team.currentPointIndex
      });
      return NextResponse.json({ 
        message: 'נקודה לא נמצאה',
        debug: debugInfo
      }, { status: 404 });
    }

    // Validate that the point has a question
    if (!point.question || !point.question.correctAnswer) {
      debugInfo.stage = 'question_validation_failed';
      console.error('Point has no question or correct answer:', {
        pointId: point._id,
        hasQuestion: !!point.question,
        hasCorrectAnswer: !!(point.question && point.question.correctAnswer)
      });
      return NextResponse.json({ 
        message: 'שגיאה בטעינת השאלה',
        debug: debugInfo
      }, { status: 500 });
    }

    debugInfo.stage = 'validating_answer';
    const correct = point.question.correctAnswer === answer;
    console.log('Answer validation:', {
      submitted: answer,
      correct: point.question.correctAnswer,
      isCorrect: correct,
      debugInfo
    });

    if (!correct) {
      debugInfo.stage = 'processing_incorrect_answer';
      // Get the current team state with a fresh query and no cache
      const currentTeam = await Team.findById(team._id)
        .populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        })
        .exec();

      if (!currentTeam) {
        console.error('Could not find team for attempts update');
        return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
      }

      // Log current state
      console.log('Team state before update:', {
        teamId: currentTeam._id,
        currentAttempts: currentTeam.attempts,
        penaltyEndTime: currentTeam.penaltyEndTime
      });

      // Increment attempts counter
      const attempts = (currentTeam.attempts || 0) + 1;
      console.log('Incrementing attempts from', currentTeam.attempts, 'to', attempts);
      
      // Update attempts first and get the updated team
      const updatedTeam = await Team.findByIdAndUpdate(
        currentTeam._id,
        { $set: { attempts: attempts } },
        { new: true }
      ).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });

      if (!updatedTeam) {
        console.error('Failed to update attempts');
        return NextResponse.json({ message: 'שגיאה בעדכון מספר הניסיונות' }, { status: 500 });
      }

      // Now check the updated attempts count
      if (attempts === 2) {
        console.log('Processing second attempt, applying penalty');
        const penaltyMinutes = updatedTeam.currentRoute?.settings?.penaltyTime || 2;
        const penaltyTime = penaltyMinutes * 60 * 1000;
        const penaltyEndTime = new Date(Date.now() + penaltyTime);
        
        // Apply penalty and set hint level to 1 (zoom out)
        await Team.findByIdAndUpdate(
          updatedTeam._id,
          { 
            $set: { 
              penaltyEndTime: penaltyEndTime
            }
          },
          { new: true }
        );
        
        // Request hint level 1 (zoom out)
        await requestAutomaticHint(teamId, pointId, 1);

        return NextResponse.json({
          correct: false,
          message: 'טעית, המתן לזמן העונשין',
          penaltyEndTime: penaltyEndTime.toISOString(),
          attempts: attempts,
          hintRequested: true,
          hintLevel: 1
        });
      }
      else if (attempts === 3) {
        console.log('Processing third attempt, moving to next point');
        const penaltyMinutes = updatedTeam.currentRoute?.settings?.penaltyTime || 2;
        const penaltyTime = penaltyMinutes * 60 * 1000;
        const penaltyEndTime = new Date(Date.now() + penaltyTime);
        
        // Get the next point name if available
        const nextPointIndex = updatedTeam.currentPointIndex + 1;
        const nextPointName = nextPointIndex < updatedTeam.currentRoute.points.length 
          ? updatedTeam.currentRoute.points[nextPointIndex].name 
          : 'הבאה';
        
        // Apply penalty and move to next point
        await Team.findByIdAndUpdate(
          updatedTeam._id,
          { 
            $set: { 
              penaltyEndTime: penaltyEndTime,
              attempts: 0 // Reset attempts for next point
            },
            $inc: { currentPointIndex: 1 }
          },
          { new: true }
        );

        return NextResponse.json({
          correct: false,
          message: `טעית, המתן לזמן העונשין ואז רוץ לנקודה ${nextPointName}`,
          penaltyEndTime: penaltyEndTime.toISOString(),
          attempts: attempts
        });
      }
      else {
        console.log('Processing first attempt');
        return NextResponse.json({
          correct: false,
          message: 'טעית, נסה שוב',
          attempts
        });
      }
    }

    // If answer is correct, reset attempts counter and update visited points
    console.log('Processing correct answer, updating team state');
    
    // Use the actual team._id instead of the teamId from the request
    const updateResult = await Team.findByIdAndUpdate(
      team._id, // Use team._id instead of teamId from request
      {
        $set: { attempts: 0 },
        $push: { visitedPoints: pointId }
      },
      { new: true }
    ).populate({
      path: 'currentRoute',
      populate: {
        path: 'points'
      }
    });

    if (!updateResult) {
      debugInfo.stage = 'update_failed';
      console.error('Failed to update team after correct answer');
      return NextResponse.json({ 
        message: 'שגיאה בעדכון הקבוצה',
        debug: debugInfo
      }, { status: 500 });
    }

    console.log('Team updated successfully after correct answer:', {
      teamId: updateResult._id,
      currentPointIndex: updateResult.currentPointIndex,
      visitedPoints: updateResult.visitedPoints,
      debugInfo
    });

    // עדכון האינדקס לנקודה הבאה אחרי הנקודה האחרונה שהושלמה
    const lastCompletedPointIndex = updateResult.currentRoute.points.findIndex(
      point => point._id.toString() === updateResult.visitedPoints[updateResult.visitedPoints.length - 1]
    );
    
    if (lastCompletedPointIndex !== -1 && lastCompletedPointIndex + 1 < updateResult.currentRoute.points.length) {
      updateResult.currentPointIndex = lastCompletedPointIndex + 1;
    } else if (lastCompletedPointIndex === updateResult.currentRoute.points.length - 1) {
      // אם הנקודה האחרונה הושלמה, השאר את האינדקס עליה
      updateResult.currentPointIndex = lastCompletedPointIndex;
    }

    await updateResult.save();

    // Get the next point name if available
    const nextPointIndex = updateResult.currentPointIndex;
    const nextPointName = nextPointIndex < updateResult.currentRoute.points.length 
      ? updateResult.currentRoute.points[nextPointIndex].name 
      : 'הבאה';

    return NextResponse.json({
      message: `נכון מאד! "${answer}" - רוץ לנקודה ${nextPointName}`,
      correct: true,
      team: updateResult
    });
  } catch (error) {
    debugInfo.stage = 'error_caught';
    debugInfo.error = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : 'Unknown error';
    
    console.error('Error processing answer:', {
      error,
      debugInfo
    });
    
    return NextResponse.json(
      { 
        message: 'שגיאה בעיבוד התשובה',
        debug: debugInfo
      },
      { status: 500 }
    );
  }
} 