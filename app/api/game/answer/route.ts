import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose, { Document, Model } from 'mongoose';
import { Team, ITeam } from '../../../models/Team';
import Route from '../../../models/Route';
import Point from '../../../models/Point';
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

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { teamId, pointId, answer } = await request.json();

    console.log('Processing answer for teamId:', teamId);

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
      // First check if we're about to reach the third attempt
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

      // If this will be the third attempt, apply penalty
      if ((currentTeam.attempts || 0) >= 2) {
        const penaltyMinutes = currentTeam.currentRoute.settings?.penaltyTime || 2;
        const penaltyTime = penaltyMinutes * 60 * 1000; // Convert minutes to milliseconds
        await (Team as Model<TeamWithRoute>).updateOne(
          { _id: team._id },
          { 
            $set: { 
              penaltyEndTime: new Date(Date.now() + penaltyTime),
              attempts: 0
            }
          }
        ).exec();

        // Don't include next point info in the response
        return NextResponse.json({
          correct: false,
          message: `נפסלתם - המתינו ${penaltyMinutes} דקות לקבלת הנקודה הבאה`,
          penaltyEndTime: new Date(Date.now() + penaltyTime).toISOString()
        });
      }

      // If we're not at penalty yet, increment the attempts counter
      await (Team as Model<TeamWithRoute>).updateOne(
        { _id: team._id },
        { $inc: { attempts: 1 } }
      ).exec();

      const attempts = (currentTeam.attempts || 0) + 1;
      console.log('Updated team attempts:', attempts); // Debug log

      // Return appropriate message based on attempt number
      const message = attempts === 1 ? 'טעות ראשונה' : 'טעות שניה';
      console.log('Selected message:', message, 'for attempts:', attempts); // Debug log
      
      return NextResponse.json({
        correct: false,
        message,
        attempts
      });
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
        message: 'רוצו לנקודה הבאה',
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