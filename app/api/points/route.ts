import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import type { Point as IPoint } from '../../types';

const PointSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  location: {
    type: [Number],
    required: true,
    validate: {
      validator: (v: number[]) => v.length === 2,
      message: 'Location must be [latitude, longitude]'
    }
  },
  question: {
    text: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
    }
  }
}, {
  timestamps: true
});

const Point = (mongoose.models.Point as Model<IPoint>) || mongoose.model<IPoint>('Point', PointSchema);

export async function GET() {
  try {
    await dbConnect();
    const points = await Point.find({});
    return NextResponse.json(points);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();

    // Handle bulk creation if points array is provided
    if (Array.isArray(data.points)) {
      const points = await Point.create(data.points);
      return NextResponse.json(points);
    }

    // Handle single point creation
    const point = await Point.create(data);
    return NextResponse.json(point);
  } catch (error) {
    console.error('Error creating point(s):', error);
    return NextResponse.json({ error: 'Failed to create point(s)', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const { _id, ...updateData } = data;
    
    const point = await Point.findByIdAndUpdate(_id, updateData, { new: true });
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 });
    }
    
    return NextResponse.json(point);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update point' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await Point.deleteMany({});
    return NextResponse.json({ message: 'All points deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete points' }, { status: 500 });
  }
} 