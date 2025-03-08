import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import Route from '../../../models/Route';
import Point from '../../../models/Point';

export async function GET(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', Point.schema);
    }

    const route = await (Route as Model<any>).findById(params.routeId)
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
    console.error('Error fetching route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch route' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Validate that points exist if they're being updated
    if (data.points && (!Array.isArray(data.points) || data.points.length === 0)) {
      return NextResponse.json({ 
        error: 'Route must have at least one point',
      }, { status: 400 });
    }

    const route = await (Route as Model<any>).findByIdAndUpdate(
      params.routeId,
      data,
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
    return NextResponse.json(
      { error: 'Failed to update route' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  try {
    await dbConnect();
    
    const route = await (Route as Model<any>).findByIdAndDelete(params.routeId)
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
    return NextResponse.json(
      { error: 'Failed to delete route' },
      { status: 500 }
    );
  }
} 