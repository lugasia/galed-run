import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import mongoose from 'mongoose';
import { Team } from '../../../models/Team';
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
    const { teamId, code, location } = await request.json();

    console.log('Verifying point for teamId:', teamId);

    // Find team first by ID, then by uniqueLink
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await (Team as any).findById(teamId)
          .populate({
            path: 'currentRoute',
            populate: {
              path: 'points',
              model: 'Point'
            }
          });
        if (team) {
          console.log('Team found by ID');
        }
      }
    } catch (err) {
      console.log('Error searching by ID:', err);
    }

    if (!team) {
      console.log('Team not found by ID, searching by uniqueLink...');
      team = await (Team as any).findOne({
        uniqueLink: teamId
      }).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
      
      if (team) {
        console.log('Team found by uniqueLink');
      } else {
        console.log('Team not found by uniqueLink either');
      }
    }

    if (!team) {
      console.log('No team found with ID/uniqueLink:', teamId);
      return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
    }

    // Find point by code
    const point = team.currentRoute.points.find((p: any) => p.code === code);
    if (!point) {
      return NextResponse.json({ message: 'קוד לא נכון' }, { status: 400 });
    }

    // Update team's current location if provided
    if (location) {
      team.currentLocation = {
        type: 'Point',
        coordinates: [location[1], location[0]], // Convert to [longitude, latitude] for GeoJSON
        timestamp: new Date()
      };

      // Send WebSocket update
      const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'LOCATION_UPDATE',
          teamId: team._id,
          coordinates: location,
          timestamp: new Date()
        }));
        ws.close();
      });
    }

    // Add point to visited points
    team.visitedPoints.push(point._id);
    await team.save();

    // Create event
    await mongoose.models.Event.create({
      team: team._id,
      type: 'POINT_REACHED',
      point: point._id,
      route: team.currentRoute._id,
      location: location ? {
        type: 'Point',
        coordinates: [location[1], location[0]]
      } : undefined,
    });

    return NextResponse.json({
      pointId: point._id,
      message: 'הגעת לנקודה בהצלחה'
    });
  } catch (error) {
    console.error('Error verifying point:', error);
    return NextResponse.json({ message: 'שגיאה באימות הקוד' }, { status: 500 });
  }
} 