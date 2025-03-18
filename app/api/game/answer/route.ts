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
  try {
    await dbConnect();
    const { teamId, pointId, answer } = await request.json();

    console.log('Processing answer for teamId:', teamId, 'pointId:', pointId, 'answer:', answer);
    
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

    // Validate that the point exists
    if (!team.currentRoute || !team.currentRoute.points || team.currentRoute.points.length === 0) {
      console.error('Team has no route or points array is empty');
      return NextResponse.json({ message: 'שגיאה בטעינת הנקודה' }, { status: 500 });
    }

    // Validate current point index
    if (team.currentPointIndex < 0 || team.currentPointIndex >= team.currentRoute.points.length) {
      console.error('Current point index out of bounds:', team.currentPointIndex);
      return NextResponse.json({ message: 'שגיאה בטעינת הנקודה' }, { status: 500 });
    }

    const point = team.currentRoute.points[team.currentPointIndex];
    if (!point) {
      console.error('Current point is undefined');
      return NextResponse.json({ message: 'נקודה לא נמצאה' }, { status: 404 });
    }

    if (point._id.toString() !== pointId) {
      console.error('Point ID mismatch:', point._id.toString(), '!=', pointId);
      return NextResponse.json({ message: 'נקודה לא נמצאה' }, { status: 404 });
    }

    // Validate that the point has a question
    if (!point.question || !point.question.correctAnswer) {
      console.error('Point has no question or correct answer');
      return NextResponse.json({ message: 'שגיאה בטעינת השאלה' }, { status: 500 });
    }

    const correct = point.question.correctAnswer === answer;
    console.log('Answer is', correct ? 'correct' : 'incorrect');

    // No longer creating QUESTION_ANSWERED events
    
    if (!correct) {
      // First check if we're about to reach the second attempt
      try {
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
          console.error('Could not find team for attempts update');
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
          const updateResult = await (Team as Model<TeamWithRoute>).updateOne(
            { _id: team._id },
            { 
              $set: { 
                penaltyEndTime: new Date(Date.now() + penaltyTime),
                attempts: attempts
              }
            }
          ).exec();
          
          console.log('Update result for penalty:', updateResult);

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
          const updateResult = await (Team as Model<TeamWithRoute>).updateOne(
            { _id: team._id },
            { 
              $set: { 
                penaltyEndTime: new Date(Date.now() + penaltyTime),
                attempts: 0 // Reset attempts for next point
              },
              $inc: { currentPointIndex: 1 } // Move to next point
            }
          ).exec();
          
          console.log('Update result for move to next point:', updateResult);

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
          const updateResult = await (Team as Model<TeamWithRoute>).updateOne(
            { _id: team._id },
            { $inc: { attempts: 1 } }
          ).exec();
          
          console.log('Update result for attempts increment:', updateResult);
          console.log('Updated team attempts:', attempts); // Debug log
          
          return NextResponse.json({
            correct: false,
            message: 'טעית, נסה שוב',
            attempts
          });
        }
      } catch (attemptsError) {
        console.error('Error handling incorrect answer:', attemptsError);
        return NextResponse.json({ message: 'שגיאה בעיבוד התשובה' }, { status: 500 });
      }
    }

    // On correct answer:
    // Reset attempts counter only
    try {
      const updateResult = await (Team as Model<TeamWithRoute>).updateOne(
        { _id: team._id },
        { 
          $set: { attempts: 0 }
        }
      ).exec();
      
      console.log('Update result for correct answer:', updateResult);
    } catch (updateError) {
      console.error('Error updating team after correct answer:', updateError);
      return NextResponse.json({ message: 'שגיאה בעיבוד התשובה' }, { status: 500 });
    }

    // Return success message without changing point or index
    return NextResponse.json({ 
      correct: true,
      message: 'צדקת! רוץ לנקודה כדי להמשיך',
    });
  } catch (error) {
    console.error('Error processing answer:', error);
    return NextResponse.json(
      { message: 'שגיאה בעיבוד התשובה' },
      { status: 500 }
    );
  }
} 