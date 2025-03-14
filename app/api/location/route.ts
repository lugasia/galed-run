import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose from 'mongoose';
import { Team } from '../../models/Team';
import Point, { PointSchema } from '../../models/Point';
import Route, { RouteSchema } from '../../models/Route';

export async function POST(request: Request) {
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

    const { teamId, coordinates } = await request.json();

    // Update team's current location
    await mongoose.models.Team.updateOne(
      { _id: teamId },
      {
        currentLocation: {
          coordinates,
          timestamp: new Date(),
        },
      }
    );

    // Check if team is near any point in their route
    const team = await mongoose.models.Team.findById(teamId).populate({
      path: 'currentRoute',
      populate: {
        path: 'points',
        model: 'Point',
      },
    });

    if (team?.currentRoute) {
      const points = team.currentRoute.points;
      for (const point of points) {
        const distance = calculateDistance(
          coordinates[0],
          coordinates[1],
          point.coordinates[0],
          point.coordinates[1]
        );

        // If team is within 10 meters of a point and hasn't visited it yet
        if (
          distance <= 10 &&
          !team.visitedPoints.some((vp: any) => vp.point.toString() === point._id.toString())
        ) {
          // No longer creating POINT_REACHED events
          console.log('Team reached point but not creating event');
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

// Calculate distance between two points in meters using the Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
} 