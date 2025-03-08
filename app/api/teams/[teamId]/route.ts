import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import mongoose from 'mongoose';
import Event from '../../../models/Event';

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
    
    const team = await (Team as any).findById(params.teamId)
      .populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(team)));
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team data' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
    const body = await request.json();

    // Handle restart
    if (body.action === 'restart') {
      // Try to find team by ID first, then by uniqueLink
      let team;
      try {
        if (mongoose.Types.ObjectId.isValid(params.teamId)) {
          team = await (Team as any).findById(params.teamId).populate({
            path: 'currentRoute',
            populate: {
              path: 'points',
              model: 'Point'
            }
          });

          if (team) {
            // Set initial location to the first point in the route
            const firstPoint = team.currentRoute.points[0];
            team = await (Team as any).findByIdAndUpdate(
              params.teamId,
              {
                $set: {
                  startTime: new Date(),
                  currentPointIndex: 0,
                  visitedPoints: [],
                  penaltyEndTime: null,
                  attempts: 0,
                  currentLocation: {
                    type: 'Point',
                    coordinates: firstPoint.location,
                    timestamp: new Date()
                  }
                }
              },
              { new: true }
            ).populate({
              path: 'currentRoute',
              populate: {
                path: 'points',
                model: 'Point'
              }
            });
          }
        }
      } catch (err) {
        console.error('Error searching/updating by ID:', err);
      }
      
      if (!team) {
        team = await (Team as any).findOneAndUpdate(
          { uniqueLink: params.teamId },
          {
            $set: {
              startTime: new Date(),
              currentPointIndex: 0,
              visitedPoints: [],
              penaltyEndTime: null,
              attempts: 0,
              currentLocation: null
            }
          },
          { new: true }
        ).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Create restart event
      await (Event as any).create({
        team: team._id,
        type: 'ROUTE_STARTED',
        route: team.currentRoute._id,
        details: { restarted: true }
      });

      return NextResponse.json(JSON.parse(JSON.stringify(team)));
    }

    // Handle regular updates
    let team;
    
    // Try to find team by ID first, then by uniqueLink
    try {
      if (mongoose.Types.ObjectId.isValid(params.teamId)) {
        // If setting startTime, also set initial location
        if (body.startTime) {
          const existingTeam = await (Team as any).findById(params.teamId).populate({
            path: 'currentRoute',
            populate: {
              path: 'points',
              model: 'Point'
            }
          });

          if (existingTeam) {
            const firstPoint = existingTeam.currentRoute.points[0];
            body.currentLocation = {
              type: 'Point',
              coordinates: firstPoint.location,
              timestamp: new Date()
            };
          }
        }

        team = await (Team as any).findByIdAndUpdate(
          params.teamId,
          { $set: body },
          { new: true }
        ).populate({
          path: 'currentRoute',
          populate: {
            path: 'points',
            model: 'Point'
          }
        });
      }
    } catch (err) {
      console.error('Error searching/updating by ID:', err);
    }
    
    if (!team) {
      team = await (Team as any).findOneAndUpdate(
        { uniqueLink: params.teamId },
        { $set: body },
        { new: true }
      ).populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });
    }

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Create an event for race start if startTime is being set
    if (body.startTime) {
      await (Event as any).create({
        team: team._id,
        type: 'ROUTE_STARTED',
        route: team.currentRoute._id,
      });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(team)));
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Failed to update team data' },
      { status: 500 }
    );
  }
} 