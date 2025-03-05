import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';

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
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (v: number[]) => v.length === 2,
      message: 'Coordinates must be [latitude, longitude]'
    }
  },
  question: {
    text: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: String,
      required: true,
    }
  }
}, {
  timestamps: true
});

const Point = mongoose.models.Point || mongoose.model('Point', PointSchema);

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
    
    const point = await Point.create(data);
    return NextResponse.json(point);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create point' }, { status: 500 });
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

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Point ID is required' }, { status: 400 });
    }
    
    const point = await Point.findByIdAndDelete(id);
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Point deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete point' }, { status: 500 });
  }
} 