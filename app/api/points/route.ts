import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import type { Point as IPoint } from '../../types';
import Point, { PointSchema } from '../../models/Point';
import Route, { RouteSchema } from '../../models/Route';
import { cookies } from 'next/headers';

// Use the imported Point model and schema instead of defining locally
// const PointSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   code: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   location: {
//     type: [Number],
//     required: true,
//     validate: {
//       validator: (v: number[]) => v.length === 2,
//       message: 'Location must be [latitude, longitude]'
//     }
//   },
//   question: {
//     text: {
//       type: String,
//       required: true,
//     },
//     options: {
//       type: [String],
//       required: true,
//     },
//     correctAnswer: {
//       type: String,
//       required: true,
//     }
//   }
// }, {
//   timestamps: true
// });

// const Point = (mongoose.models.Point as Model<IPoint>) || mongoose.model<IPoint>('Point', PointSchema);

export async function GET(request: Request) {
  // Get API key from header or query parameter
  const apiKey = request.headers.get('x-api-key');
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get('apiKey');
  
  if ((!apiKey || apiKey !== process.env.API_SECRET) && 
      (!queryApiKey || queryApiKey !== process.env.API_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }
    
    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }

    const points = await Point.find({});
    return NextResponse.json(points);
  } catch (error) {
    console.error('Error fetching points:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Get API key from header or query parameter
  const apiKey = request.headers.get('x-api-key');
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get('apiKey');
  
  if ((!apiKey || apiKey !== process.env.API_SECRET) && 
      (!queryApiKey || queryApiKey !== process.env.API_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    const data = await request.json();
    const point = await Point.create(data);
    return NextResponse.json(point, { status: 201 });
  } catch (error) {
    console.error('Error creating point:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  // Get API key from header or query parameter
  const apiKey = request.headers.get('x-api-key');
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get('apiKey');
  
  if ((!apiKey || apiKey !== process.env.API_SECRET) && 
      (!queryApiKey || queryApiKey !== process.env.API_SECRET)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

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
  // Get API key from header or query parameter
  const apiKey = request.headers.get('x-api-key');
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get('apiKey');
  
  if ((!apiKey || apiKey !== process.env.API_SECRET) && 
      (!queryApiKey || queryApiKey !== process.env.API_SECRET)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    await Point.deleteMany({});
    return NextResponse.json({ message: 'All points deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete points' }, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
} 