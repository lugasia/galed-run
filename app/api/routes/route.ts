import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import type { Point as IPoint } from '../../types';
import RouteModel from '../../models/Route';
import PointModel from '../../models/Point';

interface IRoute extends mongoose.Document {
  name: string;
  points: mongoose.Types.ObjectId[] | IPoint[];
  teams: mongoose.Types.ObjectId[];
  settings: {
    penaltyTime: number;
    maxAttempts: number;
  };
  active: boolean;
}

const PointSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
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
      default: '',
    },
    options: {
      type: [String],
      default: ['', '', '', ''],
    },
    correctAnswer: {
      type: String,
      default: '',
    }
  }
}, {
  timestamps: true
});

const Point = (mongoose.models.Point as Model<IPoint>) || mongoose.model<IPoint>('Point', PointSchema);

const RouteSchema = new mongoose.Schema<IRoute>({
  name: {
    type: String,
    required: true,
  },
  points: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
    required: true
  }],
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  settings: {
    penaltyTime: {
      type: Number,
      default: 2,
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Route = (mongoose.models.Route || mongoose.model<IRoute>('Route', RouteSchema)) as Model<IRoute>;

export async function GET() {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointModel.schema);
    }

    const routes = await Route.find()
      .populate({
        path: 'points',
        model: mongoose.models.Point,
        select: 'name code location question'
      })
      .lean()
      .exec();

    console.log('Routes with points:', routes);

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Validate that points exist
    if (!data.points || !Array.isArray(data.points) || data.points.length === 0) {
      return NextResponse.json({ 
        error: 'Route must have at least one point',
      }, { status: 400 });
    }

    // Create route with points
    const route = await Route.create({
      name: data.name,
      points: data.points,
      active: true,
      teams: [],
      settings: {
        penaltyTime: 2,
        maxAttempts: 3
      }
    });
    
    // Return populated route
    const populatedRoute = await Route.findById(route._id)
      .populate({
        path: 'points',
        model: mongoose.models.Point,
        select: 'name code location question'
      })
      .lean()
      .exec();

    return NextResponse.json(populatedRoute);
  } catch (error) {
    console.error('Error creating route:', error);
    return NextResponse.json({ 
      error: 'Failed to create route', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const { _id, ...updateData } = data;
    
    // Validate that points exist if they're being updated
    if (updateData.points && (!Array.isArray(updateData.points) || updateData.points.length === 0)) {
      return NextResponse.json({ 
        error: 'Route must have at least one point',
      }, { status: 400 });
    }

    const route = await Route.findByIdAndUpdate(
      _id,
      updateData,
      { new: true }
    )
    .populate({
      path: 'points',
      model: mongoose.models.Point,
      select: 'name code location question'
    })
    .lean()
    .exec();

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    
    return NextResponse.json(route);
  } catch (error) {
    console.error('Error updating route:', error);
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
    
    const route = await Route.findByIdAndDelete(id)
      .populate({
        path: 'points',
        model: mongoose.models.Point,
        select: 'name code location question'
      })
      .lean()
      .exec();

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 });
  }
} 