import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import Route, { RouteSchema } from '../../../models/Route';
import Point, { PointSchema } from '../../../models/Point';

export async function GET(
  request: Request,
  { params }: { params: { routeId: string } }
) {
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
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }

    const data = await request.json();
    
    // Validate that points exist if they're being updated
    if (data.points && (!Array.isArray(data.points) || data.points.length === 0)) {
      return NextResponse.json({ 
        error: 'Route must have at least one point',
      }, { status: 400 });
    }

    // If points are being updated, verify they exist in the database
    if (data.points && Array.isArray(data.points) && data.points.length > 0) {
      const pointIds = data.points.map(pointId => 
        typeof pointId === 'string' ? pointId : pointId._id
      );
      
      const foundPoints = await Point.find({
        _id: { $in: pointIds }
      });
      
      if (foundPoints.length !== pointIds.length) {
        const foundIds = foundPoints.map(point => point._id.toString());
        const missingIds = pointIds.filter(id => !foundIds.includes(id.toString()));
        
        return NextResponse.json({ 
          error: 'Some points do not exist in the database',
          missingPoints: missingIds
        }, { status: 400 });
      }
      
      // Update the points array to use the IDs
      data.points = pointIds;
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
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { routeId: string } }
) {
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