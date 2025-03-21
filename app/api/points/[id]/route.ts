import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { Point } from '../../../../models/Point';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const point = await Point.findById(params.id);
    
    if (!point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(point);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch point' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.question || !data.qrCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if QR code is unique (excluding current point)
    const existingPoint = await Point.findOne({
      qrCode: data.qrCode,
      _id: { $ne: params.id }
    });
    if (existingPoint) {
      return NextResponse.json(
        { error: 'QR code already exists' },
        { status: 400 }
      );
    }

    const point = await Point.findByIdAndUpdate(
      params.id,
      { $set: data },
      { new: true }
    );
    
    if (!point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(point);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update point' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const point = await Point.findByIdAndDelete(params.id);
    
    if (!point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Point deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete point' },
      { status: 500 }
    );
  }
} 