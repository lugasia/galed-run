import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';

const RouteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  points: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
  }],
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  settings: {
    penaltyTime: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },
  },
  active: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true
});

const Route = mongoose.models.Route || mongoose.model('Route', RouteSchema);

export async function GET() {
  try {
    await dbConnect();
    const routes = await Route.find({}).populate('points', 'name code');
    return NextResponse.json(routes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    
    const route = await Route.create({
      ...data,
      active: true,
    });
    
    return NextResponse.json(route);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const { _id, ...updateData } = data;
    
    const route = await Route.findByIdAndUpdate(_id, updateData, { new: true });
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    
    return NextResponse.json(route);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }
    
    const route = await Route.findByIdAndDelete(id);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Route deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 });
  }
} 