import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Route from '../../../models/Route';
import { Team } from '../../../models/Team';
import Point from '../../../models/Point';

interface ImportData {
  routes?: {
    name: string;
    points: {
      name: string;
      code: string;
      location: [number, number];
      question: {
        text: string;
        options: string[];
        correctAnswer: string;
      };
    }[];
  }[];
  teams?: {
    name: string;
    leaderName: string;
    routeName: string;
  }[];
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data: ImportData = await request.json();
    
    const created = {
      routes: 0,
      teams: 0
    };

    // Import routes and points
    if (data.routes?.length) {
      for (const routeData of data.routes) {
        // Create points first
        const pointDocs = await Promise.all(routeData.points.map(async (pointData) => {
          const point = new Point({
            name: pointData.name,
            code: pointData.code,
            location: {
              type: 'Point',
              coordinates: pointData.location
            },
            question: pointData.question
          });
          await point.save();
          return point;
        }));

        // Create route with references to points
        const route = new Route({
          name: routeData.name,
          points: pointDocs.map(p => p._id)
        });
        await route.save();
        created.routes++;
      }
    }

    // Import teams
    if (data.teams?.length) {
      for (const teamData of data.teams) {
        // Find the route by name
        const route = await Route.findOne({ name: teamData.routeName });
        if (!route) {
          console.warn(`Route not found: ${teamData.routeName}`);
          continue;
        }

        const team = new Team({
          name: teamData.name,
          leaderName: teamData.leaderName,
          route: route._id
        });
        await team.save();
        created.teams++;
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import data' },
      { status: 500 }
    );
  }
} 