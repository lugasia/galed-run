import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import { Team, ITeam } from '../../models/Team';
import Route, { RouteSchema } from '../../models/Route';
import Point, { PointSchema } from '../../models/Point';

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteSchema);
    }
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointSchema);
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const updateLinks = searchParams.get('updateLinks') === 'true';
    
    // Build query based on parameters - don't filter by startTime existence
    // This ensures teams are always visible even if they started prematurely
    const query = activeOnly ? { 
      currentRoute: { $exists: true }
    } : {};

    console.log('Fetching teams with query:', query);

    // Select only necessary fields and transform the data
    const teams = await (Team as Model<ITeam>).find(query)
      .select('name leaderName currentRoute currentLocation startTime active uniqueLink visitedPoints currentPointIndex')
      .populate({
        path: 'currentRoute',
        select: 'name points',
        populate: {
          path: 'points',
          model: 'Point',
          select: 'name code location'
        }
      })
      .lean()
      .exec();
    
    console.log(`Found ${teams.length} teams`);
    
    // Update uniqueLinks if requested
    if (updateLinks) {
      for (const team of teams) {
        const uniqueLink = team.uniqueLink;
        
        // Skip if the uniqueLink is already in the correct format
        if (uniqueLink.startsWith('https://') && uniqueLink.includes('/game/') && !uniqueLink.includes('/admin/')) {
          continue;
        }
        
        // Clean the link
        let cleanLink = uniqueLink;
        
        // Remove @ from the beginning if it exists
        if (cleanLink.startsWith('@')) {
          cleanLink = cleanLink.substring(1);
        }
        
        // Fix links that contain /admin/game/ instead of /game/
        if (cleanLink.includes('/admin/game/')) {
          cleanLink = cleanLink.replace('/admin/game/', '/game/');
        }
        
        // Extract the teamId
        let teamId;
        if (cleanLink.includes('/game/')) {
          teamId = cleanLink.split('/game/')[1];
        } else if (!cleanLink.includes('/')) {
          teamId = cleanLink;
        } else {
          // Try to extract the last part of the URL
          const parts = cleanLink.split('/');
          teamId = parts[parts.length - 1];
        }
        
        // Create the correct URL
        const formattedLink = `https://galedrun.vercel.app/game/${teamId}`;
        
        // Update the team in the database
        await (Team as Model<ITeam>).updateOne(
          { _id: team._id },
          { $set: { uniqueLink: formattedLink } }
        );
        
        // Update the team in the current results
        team.uniqueLink = formattedLink;
      }
      
      console.log('Updated uniqueLinks for all teams');
    }
    
    // Transform the data to match our types
    const transformedTeams = teams.map((team: any) => ({
      _id: team._id.toString(),
      name: team.name,
      leaderName: team.leaderName,
      uniqueLink: team.uniqueLink,
      currentRoute: team.currentRoute ? {
        _id: team.currentRoute._id.toString(),
        name: team.currentRoute.name,
        points: team.currentRoute.points.map((point: any) => ({
          _id: point._id.toString(),
          name: point.name,
          code: point.code,
          location: point.location
        }))
      } : undefined,
      currentPointIndex: team.currentPointIndex,
      currentLocation: team.currentLocation,
      startTime: team.startTime,
      active: team.active
    }));
    
    return NextResponse.json(transformedTeams);
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    
    console.log('Creating new team with data:', {
      name: data.name,
      leaderName: data.leaderName,
      currentRoute: data.currentRoute
    });
    
    // Generate a unique link for the team
    const uniqueId = Math.random().toString(36).substring(2, 15);
    console.log('Generated uniqueId:', uniqueId);
    
    // Create the URL for the team's unique link
    const formattedLink = `https://galedrun.vercel.app/game/${uniqueId}`;
    
    // Create team with only the basic required fields
    const team = await (Team as Model<ITeam>).create({
      name: data.name,
      leaderName: data.leaderName,
      uniqueLink: formattedLink,
      currentRoute: new mongoose.Types.ObjectId(data.currentRoute),
      currentPointIndex: 0,
      attempts: 0,
      visitedPoints: []
    });
    
    console.log('Created team:', {
      id: team._id,
      name: team.name,
      uniqueLink: team.uniqueLink
    });
    
    // Populate the route information
    const populatedTeam = await team.populate({
      path: 'currentRoute',
      populate: {
        path: 'points',
        model: 'Point'
      }
    });
    
    console.log('Team populated with route:', {
      id: populatedTeam._id,
      name: populatedTeam.name,
      uniqueLink: populatedTeam.uniqueLink,
      hasCurrentRoute: !!populatedTeam.currentRoute
    });
    
    return NextResponse.json(populatedTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ 
      error: 'Failed to create team',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const { _id, ...updateData } = data;
    
    const updatedTeam = await (Team as Model<ITeam>).findByIdAndUpdate(
      _id,
      updateData,
      { new: true }
    ).populate({
      path: 'currentRoute',
      populate: {
        path: 'points',
        model: 'Point'
      }
    });
    
    if (!updatedTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    return NextResponse.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    
    const deletedTeam = await (Team as Model<ITeam>).findByIdAndDelete(id)
      .populate({
        path: 'currentRoute',
        populate: {
          path: 'points',
          model: 'Point'
        }
      });

    if (!deletedTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
} 