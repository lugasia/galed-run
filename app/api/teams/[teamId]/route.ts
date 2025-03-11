import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { Team, ITeam } from '../../../models/Team';
import mongoose from 'mongoose';
import Event from '../../../models/Event';
import Point, { PointSchema } from '../../../models/Point';

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

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
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    const body = await request.json();

    console.log('PUT /api/teams/[teamId] - Request body:', body);
    console.log('Team ID:', params.teamId);

    // Handle restart
    if (body.action === 'restart') {
      // Try to find team by ID first, then by uniqueLink
      let team;
      try {
        if (mongoose.Types.ObjectId.isValid(params.teamId)) {
          console.log('Valid ObjectId, searching by ID...');
          team = await (Team as any).findById(params.teamId).populate({
            path: 'currentRoute',
            populate: {
              path: 'points',
              model: 'Point'
            }
          });

          if (team) {
            console.log('Found team by ID for restart:', team._id);
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
            console.log('Team restarted successfully');
          }
        }
      } catch (err) {
        console.error('Error searching/updating by ID:', err);
      }
      
      if (!team) {
        console.log('Team not found by ID, trying uniqueLink:', params.teamId);
        
        // Extract the teamId from the full URL if it's a full URL
        let searchId = params.teamId;
        
        // Remove @ from the beginning if it exists
        if (searchId.startsWith('@')) {
          searchId = searchId.substring(1);
        }
        
        // Check if the teamId is a full URL
        if (searchId.includes('/game/')) {
          // Extract the last part of the URL (the actual teamId)
          const urlParts = searchId.split('/');
          searchId = urlParts[urlParts.length - 1];
          console.log('Extracted teamId from URL:', searchId);
        }
        
        // First try to find by exact uniqueLink match
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
        
        // If not found, try to find by uniqueLink that ends with the teamId
        if (!team) {
          console.log('Team not found by exact uniqueLink, trying to find by URL ending with teamId...');
          team = await (Team as any).findOneAndUpdate(
            { uniqueLink: { $regex: searchId + '$' } },
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
        
        if (team) {
          console.log('Team found and restarted by uniqueLink');
        }
      }

      if (!team) {
        console.log('Team not found for restart');
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Create restart event
      await (Event as any).create({
        team: team._id,
        type: 'ROUTE_STARTED',
        route: team.currentRoute._id,
        details: { restarted: true }
      });
      console.log('Created restart event');

      return NextResponse.json(JSON.parse(JSON.stringify(team)));
    }

    // Handle regular updates
    let team;
    
    // Try to find team by ID first, then by uniqueLink
    try {
      if (mongoose.Types.ObjectId.isValid(params.teamId)) {
        console.log('Valid ObjectId, updating by ID...');
        
        // If setting startTime, also set initial location
        if (body.startTime) {
          console.log('Setting startTime and initial location');
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
            
            // Ensure the team is marked as active
            body.active = true;
            
            console.log('Setting initial location to:', body.currentLocation);
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
        
        if (team) {
          console.log('Team updated by ID:', team._id);
        }
      }
    } catch (err) {
      console.error('Error searching/updating by ID:', err);
    }
    
    if (!team) {
      console.log('Team not found by ID, trying uniqueLink:', params.teamId);
      
      // Extract the teamId from the full URL if it's a full URL
      let searchId = params.teamId;
      
      // Remove @ from the beginning if it exists
      if (searchId.startsWith('@')) {
        searchId = searchId.substring(1);
      }
      
      // Check if the teamId is a full URL
      if (searchId.includes('/game/')) {
        // Extract the last part of the URL (the actual teamId)
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1];
        console.log('Extracted teamId from URL:', searchId);
      }
      
      // First try to find by exact uniqueLink match
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
      
      // If not found, try to find by uniqueLink that ends with the teamId
      if (!team) {
        console.log('Team not found by exact uniqueLink, trying to find by URL ending with teamId...');
        team = await (Team as any).findOneAndUpdate(
          { uniqueLink: { $regex: searchId + '$' } },
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
      
      if (team) {
        console.log('Team updated by uniqueLink:', team._id);
      }
    }

    if (!team) {
      console.log('Team not found for update');
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Create an event for race start if startTime is being set
    if (body.startTime) {
      console.log('Creating ROUTE_STARTED event');
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