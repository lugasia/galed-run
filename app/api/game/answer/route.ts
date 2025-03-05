import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { teamId, pointId, answer } = await request.json();

    const [team, point] = await Promise.all([
      mongoose.models.Team.findById(teamId),
      mongoose.models.Point.findById(pointId),
    ]);

    if (!team || !point) {
      return NextResponse.json(
        { error: 'Team or point not found' },
        { status: 404 }
      );
    }

    const correct = point.question.correctAnswer === answer;

    // Create an event for the answer
    await mongoose.models.Event.create({
      team: teamId,
      type: 'QUESTION_ANSWERED',
      point: pointId,
      route: team.currentRoute,
      details: {
        answer,
        correct,
        attempts: team.visitedPoints.find((vp: any) => vp.point.toString() === pointId)
          ?.attempts || 0,
      },
    });

    if (correct) {
      // Update team's visited points
      await mongoose.models.Team.updateOne(
        { _id: teamId },
        {
          $push: {
            visitedPoints: {
              point: pointId,
              timestamp: new Date(),
              attempts: 1,
            },
          },
        }
      );

      // Check if all points have been visited
      const route = await mongoose.models.Route.findById(team.currentRoute);
      if (route) {
        const visitedPoints = new Set(
          team.visitedPoints.map((vp: any) => vp.point.toString())
        );
        visitedPoints.add(pointId);

        const allPointsVisited = route.points.every((p: any) =>
          visitedPoints.has(p.toString())
        );

        if (allPointsVisited) {
          // Create route completion event
          await mongoose.models.Event.create({
            team: teamId,
            type: 'ROUTE_COMPLETED',
            route: team.currentRoute,
          });
        }
      }
    } else {
      // Update attempts count
      await mongoose.models.Team.updateOne(
        {
          _id: teamId,
          'visitedPoints.point': pointId,
        },
        {
          $inc: { 'visitedPoints.$.attempts': 1 },
        }
      );
    }

    return NextResponse.json({ correct });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process answer' },
      { status: 500 }
    );
  }
} 