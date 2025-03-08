import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';

interface IPoint {
  name: string;
  code: string;
  coordinates: [number, number];
  question: {
    text: string;
    options: string[];
    correctAnswer: string;
  };
}

const PointSchema = new mongoose.Schema<IPoint>({
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

const Point = (mongoose.models.Point as mongoose.Model<IPoint>) || mongoose.model<IPoint>('Point', PointSchema);

export async function PUT(
  request: Request,
  { params }: { params: { pointId: string } }
) {
  try {
    await dbConnect();
    const data = await request.json();
    
    const point = await Point.findByIdAndUpdate(
      params.pointId,
      { ...data },
      { new: true }
    );
    
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 });
    }
    
    return NextResponse.json(point);
  } catch (error) {
    console.error('Error updating point:', error);
    return NextResponse.json({ error: 'Failed to update point' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { pointId: string } }
) {
  try {
    await dbConnect();
    
    const point = await Point.findByIdAndDelete(params.pointId);
    
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Point deleted successfully' });
  } catch (error) {
    console.error('Error deleting point:', error);
    return NextResponse.json({ error: 'Failed to delete point' }, { status: 500 });
  }
} 