import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { Team } from '../../../../models/Team';
import mongoose, { Model } from 'mongoose';
import Point, { PointSchema } from '../../../../models/Point';
import Route, { RouteSchema } from '../../../../models/Route';

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
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

    const { location, uniqueLink } = await request.json();

    console.log('Updating location for team:', {
      teamId: params.teamId,
      uniqueLink,
      location
    });

    // Find team first by ID, then by uniqueLink
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(params.teamId)) {
        console.log('Valid ObjectId, searching by ID...');
        team = await (Team as Model<any>).findById(params.teamId);
        if (team) {
          console.log('Team found by ID');
        }
      }
    } catch (err) {
      console.log('Error searching by ID:', err);
    }

    if (!team) {
      console.log('Team not found by ID, searching by uniqueLink...');
      
      // Extract the teamId from the full URL if it's a full URL
      let searchId = uniqueLink || params.teamId;
      
      // Remove @ from the beginning if it exists
      if (searchId.startsWith('@')) {
        searchId = searchId.substring(1);
      }
      
      // Check if the searchId is a full URL
      if (searchId.includes('/game/')) {
        // Extract the last part of the URL (the actual teamId)
        const urlParts = searchId.split('/');
        searchId = urlParts[urlParts.length - 1];
        console.log('Extracted teamId from URL:', searchId);
      }
      
      // First try to find by exact uniqueLink match
      team = await (Team as Model<any>).findOne({
        uniqueLink: uniqueLink || params.teamId
      });
      
      // If not found, try to find by uniqueLink that ends with the teamId
      if (!team) {
        console.log('Team not found by exact uniqueLink, trying to find by URL ending with teamId...');
        team = await (Team as Model<any>).findOne({
          uniqueLink: { $regex: searchId + '$' }
        });
      }
      
      if (team) {
        console.log('Team found by uniqueLink');
      } else {
        console.log('Team not found by uniqueLink either');
      }
    }

    if (!team) {
      console.log('No team found with ID/uniqueLink:', params.teamId);
      return NextResponse.json({ message: 'קבוצה לא נמצאה' }, { status: 404 });
    }

    // Update team's location
    team.currentLocation = {
      type: 'Point',
      coordinates: [location[0], location[1]],
      timestamp: new Date()
    };

    await team.save();

    console.log('Location updated successfully for team:', team._id);

    return NextResponse.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { message: 'שגיאה בעדכון המיקום' },
      { status: 500 }
    );
  }
} 