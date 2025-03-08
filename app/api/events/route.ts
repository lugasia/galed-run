import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose from 'mongoose';

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

const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);

export async function GET() {
  try {
    await dbConnect();
    const events = await Event.find()
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
    const event = await Event.create(data);
    const populatedEvent = await event
      .populate('team', 'name leaderName')
      .populate('point', 'name code')
      .populate('route', 'name');
    
    return NextResponse.json(populatedEvent);
  } catch (error) {
    console.error('Failed to create event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await Event.deleteMany({});
    return NextResponse.json({ message: 'All events cleared successfully' });
  } catch (error) {
    console.error('Failed to clear events:', error);
    return NextResponse.json({ error: 'Failed to clear events' }, { status: 500 });
  }
} 