import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import mongoose, { Model } from 'mongoose';

export async function GET() {
  try {
    await dbConnect();
    
    console.log('Fetching all active teams');
    
    // Find all active teams
    const teams = await (Team as Model<ITeam>).find({
      active: true
    }).select('_id name leaderName uniqueLink currentPointIndex startTime').lean();
    
    console.log(`Found ${teams.length} active teams`);
    
    return NextResponse.json({ 
      teams: JSON.parse(JSON.stringify(teams))
    });
  } catch (error) {
    console.error('Error fetching active teams:', error);
    return NextResponse.json(
      { 
        message: 'שגיאה בטעינת הקבוצות הפעילות',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 