import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import mongoose from 'mongoose';

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();

    const team = await mongoose.models.Team.findById(params.teamId)
      .populate('currentRoute')
      .populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point',
        },
      });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({
      team,
      route: team.currentRoute,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch game state' }, { status: 500 });
  }
} 