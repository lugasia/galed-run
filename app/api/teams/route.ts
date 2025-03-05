import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  members: [{
    name: String,
    phone: String,
  }],
  currentRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  currentLocation: {
    type: {
      coordinates: [Number],
      timestamp: Date,
    },
    default: null,
  },
  visitedPoints: [{
    point: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Point',
    },
    timestamp: Date,
    attempts: Number,
  }],
  active: {
    type: Boolean,
    default: true,
  },
  uniqueLink: {
    type: String,
    unique: true,
  }
}, {
  timestamps: true
});

const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

export async function GET() {
  try {
    await dbConnect();
    const teams = await Team.find({});
    return NextResponse.json(teams);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Generate a unique link for the team
    const uniqueLink = `${process.env.NEXT_PUBLIC_APP_URL}/game/${Math.random().toString(36).substring(2, 15)}`;
    
    const team = await Team.create({
      ...data,
      uniqueLink,
      active: true,
    });
    
    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const { _id, ...updateData } = data;
    
    const team = await Team.findByIdAndUpdate(_id, updateData, { new: true });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    
    const team = await Team.findByIdAndDelete(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Team deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
} 