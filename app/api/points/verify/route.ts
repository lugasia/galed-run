import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import mongoose from 'mongoose';
import { Team } from '../../../../models/Team';
import { Point } from '../../../../models/Point';
import { Route } from '../../../../models/Route';
import { WebSocket } from 'ws';

const DISTANCE_THRESHOLD = 50; // meters

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

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { teamId, qrCode } = await request.json();

    // Find team first by ID, then by uniqueLink
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
    } catch (err) {
      console.error('Error searching by ID:', err);
    }

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Find point by QR code
    const point = await Point.findOne({ qrCode });
    if (!point) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    // Check if this is the correct next point
    const currentPointIndex = team.visitedPoints.length;
    const routePoints = team.currentRoute.points;

    if (currentPointIndex >= routePoints.length) {
      return NextResponse.json({ error: 'Route already completed' }, { status: 400 });
    }

    const expectedPoint = routePoints[currentPointIndex];
    if (point._id.toString() !== expectedPoint._id.toString()) {
      return NextResponse.json({ error: 'Wrong point - please scan the correct QR code' }, { status: 400 });
    }

    // Add point to visited points
    team.visitedPoints.push(point._id);
    team.currentPointQrCode = point.qrCode;

    // Check if this was the last point
    const isLastPoint = currentPointIndex === routePoints.length - 1;
    if (isLastPoint) {
      team.completedAt = new Date();
      team.completionTime = team.completedAt.getTime() - team.startTime.getTime();
      team.active = false;
    }

    await team.save();

    // Return updated team and point info
    return NextResponse.json({
      success: true,
      isLastPoint,
      team,
      point
    });
  } catch (error) {
    console.error('Error verifying QR code:', error);
    return NextResponse.json(
      { error: 'Failed to verify QR code' },
      { status: 500 }
    );
  }
} 