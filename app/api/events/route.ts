import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose from 'mongoose';
import Event from '../../models/Event';
import { Team } from '../../models/Team';

const EventSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  type: {
    type: String,
    enum: ['POINT_REACHED', 'QUESTION_ANSWERED', 'ROUTE_STARTED', 'ROUTE_COMPLETED', 'PENALTY_APPLIED'],
    required: true,
  },
  point: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  location: {
    type: {
      coordinates: [Number],
    },
    default: null,
  }
}, {
  timestamps: true
});

const EventModel = mongoose.models.Event || mongoose.model('Event', EventSchema);

export async function GET() {
  try {
    await dbConnect();
    const events = await EventModel.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('team', 'name leaderName')
      .populate('point', 'name code')
      .populate('route', 'name')
      .lean()
      .exec();

    const validEvents = events.filter(event => event.team);
    return NextResponse.json(validEvents);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const data = await request.json();
    
    // Find team by ID or uniqueLink
    let team;
    
    // First try to find by ID
    if (mongoose.Types.ObjectId.isValid(data.team)) {
      team = await Team.findById(data.team);
    }
    
    // If not found, try to find by uniqueLink
    if (!team) {
      // Clean the teamId
      const cleanedTeamId = data.team.replace(/[@/]/g, '');
      console.log('Searching for team with cleaned ID:', cleanedTeamId);
      
      team = await Team.findOne({
        uniqueLink: { $regex: cleanedTeamId + '$' }
      });
    }
    
    if (!team) {
      console.error('Team not found:', data.team);
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    // Create the event with the found team's ID
    const event = await EventModel.create({
      ...data,
      team: team._id
    });
    
    // If this is a route completion event, update the team's status
    if (data.type === 'ROUTE_COMPLETED') {
      // Mark the team as inactive
      team.active = false;
      // Store the completion time
      team.completionTime = data.details.finalTime;
      await team.save();
    }
    
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await EventModel.deleteMany({});
    return NextResponse.json({ message: 'All events cleared successfully' });
  } catch (error) {
    console.error('Failed to clear events:', error);
    return NextResponse.json({ error: 'Failed to clear events' }, { status: 500 });
  }
} 