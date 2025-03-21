import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import { Point } from '../../../../../models/Point';

export async function GET(
  request: Request,
  { params }: { params: { qrCode: string } }
) {
  try {
    await dbConnect();

    const point = await Point.findOne({ qrCode: params.qrCode });
    
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 });
    }
    
    return NextResponse.json(point);
  } catch (error) {
    console.error('Error getting point:', error);
    return NextResponse.json(
      { error: 'Failed to get point' },
      { status: 500 }
    );
  }
} 