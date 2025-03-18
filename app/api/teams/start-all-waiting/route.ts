import { NextResponse } from 'next/server';
import connectToDB from '../../../lib/mongodb';
import { Team } from '../../../models/Team';

export async function POST() {
  try {
    await connectToDB();

    // מצא את כל הקבוצות שעדיין לא התחילו (אין להן startTime או שה-startTime הוא null)
    const waitingTeams = await Team.find({
      $or: [
        { startTime: { $exists: false } },
        { startTime: null }
      ]
    });

    // עדכן את כל הקבוצות הממתינות עם זמן התחלה נוכחי
    const currentTime = new Date();
    const updatePromises = waitingTeams.map(team => 
      Team.findByIdAndUpdate(team._id, { 
        startTime: currentTime,
        currentPointIndex: 0,
        visitedPoints: [],
        attempts: 0,
        penaltyEndTime: null,
        hintRequested: null
      })
    );

    await Promise.all(updatePromises);

    // החזר את כל הקבוצות המעודכנות
    const allTeams = await Team.find().populate('currentRoute');
    
    return NextResponse.json(allTeams);
  } catch (error) {
    console.error('Error starting all waiting races:', error);
    return NextResponse.json(
      { error: 'Failed to start waiting races' },
      { status: 500 }
    );
  }
} 