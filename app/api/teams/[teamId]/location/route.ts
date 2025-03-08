import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { Team } from '../../../../models/Team';
import mongoose, { Model } from 'mongoose';

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    await dbConnect();
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
      team = await (Team as Model<any>).findOne({
        uniqueLink: uniqueLink || params.teamId
      });
      
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