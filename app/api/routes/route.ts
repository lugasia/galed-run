import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import mongoose, { Model } from 'mongoose';
import type { Point as IPoint } from '../../types';
import RouteModel from '../../models/Route';
import PointModel, { PointSchema } from '../../models/Point';

interface IRoute extends mongoose.Document {
  name: string;
  points: mongoose.Types.ObjectId[] | IPoint[];
  teams: mongoose.Types.ObjectId[];
  settings: {
    penaltyTime: number;
    maxAttempts: number;
  };
  active: boolean;
  includeAdvancedPoints: boolean;
}

// Use the schema from the imported Point model
// const PointSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   code: {
//     type: String,
//     required: true,
//   },
//   location: {
//     type: [Number],
//     required: true,
//     validate: {
//       validator: (v: number[]) => v.length === 2,
//       message: 'Location must be [latitude, longitude]'
//     }
//   },
//   question: {
//     text: {
//       type: String,
//       default: '',
//     },
//     options: {
//       type: [String],
//       default: ['', '', '', ''],
//     },
//     correctAnswer: {
//       type: String,
//       default: '',
//     }
//   }
// });

// Make sure Route model is registered
if (!mongoose.models.Route) {
  mongoose.model('Route', RouteModel.schema);
}

// Make sure Point model is registered
if (!mongoose.models.Point) {
  mongoose.model('Point', PointModel.schema);
}

const RouteSchema = new mongoose.Schema<IRoute>({
  name: {
    type: String,
    required: true,
  },
  points: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
    required: true
  }],
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  settings: {
    penaltyTime: {
      type: Number,
      default: 0.5, // 30 seconds
      min: 0.5,
      max: 2, // 2 minutes
    },
    maxAttempts: {
      type: Number,
      default: 2,
      min: 1,
    },
  },
  active: {
    type: Boolean,
    default: true,
  },
  includeAdvancedPoints: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Route = (mongoose.models.Route || mongoose.model<IRoute>('Route', RouteSchema)) as Model<IRoute>;

export async function GET() {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointModel.schema);
    }
    
    const routes = await Route.find()
      .populate({
        path: 'points',
        model: mongoose.models.Point,
        select: 'name code location question'
      })
      .lean()
      .exec();

    console.log('Routes with points:', routes);

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointModel.schema);
    }
    
    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteModel.schema);
    }
    
    const data = await request.json();
    
    // בדיקה אם המסלול צריך להיות אוטומטי (שאפל)
    const isAutoRoute = data.autoGenerate === true;
    
    if (isAutoRoute) {
      // מצא את כל הנקודות הרגילות (לא מתקדמות)
      const regularPoints = await PointModel.find({ isAdvanced: { $ne: true }, isFinishPoint: { $ne: true } });
      
      // מצא את נקודת הסיום (פאב)
      const finishPoint = await PointModel.findOne({ isFinishPoint: true });
      
      if (!finishPoint) {
        return NextResponse.json({ 
          error: 'Finish point (Pub) not found. Please create it first with isFinishPoint=true',
        }, { status: 400 });
      }
      
      if (regularPoints.length < 5) {
        return NextResponse.json({ 
          error: 'Not enough regular points available. Need at least 5 regular points.',
        }, { status: 400 });
      }
      
      // בחר לפחות 5 נקודות רגילות באופן אקראי
      const shuffledPoints = [...regularPoints].sort(() => 0.5 - Math.random());
      const selectedPoints = shuffledPoints.slice(0, Math.max(5, Math.min(shuffledPoints.length, 8)));
      
      // הוסף את נקודת הסיום (פאב) בסוף
      const routePoints = [...selectedPoints.map(p => p._id), finishPoint._id];
      
      // צור את המסלול
      const route = await Route.create({
        name: data.name,
        points: routePoints,
        active: true,
        teams: [],
        settings: {
          penaltyTime: data.settings?.penaltyTime || 2,
          maxAttempts: data.settings?.maxAttempts || 3
        },
        includeAdvancedPoints: data.includeAdvancedPoints || false
      });
      
      // החזר את המסלול המלא
      const populatedRoute = await Route.findById(route._id)
        .populate({
          path: 'points',
          model: mongoose.models.Point,
          select: 'name code location question images isAdvanced isFinishPoint'
        })
        .lean()
        .exec();

      return NextResponse.json(populatedRoute);
    } else {
      // המשך עם הלוגיקה הקיימת ליצירת מסלול ידני
      
      // Validate that points exist
      if (!data.points || !Array.isArray(data.points) || data.points.length === 0) {
        return NextResponse.json({ 
          error: 'Route must have at least one point',
        }, { status: 400 });
      }

      // Verify that all points exist in the database
      const pointIds = data.points.map(pointId => 
        typeof pointId === 'string' ? pointId : pointId._id
      );
      
      const foundPoints = await PointModel.find({
        _id: { $in: pointIds }
      });
      
      if (foundPoints.length !== pointIds.length) {
        const foundIds = foundPoints.map(point => point._id.toString());
        const missingIds = pointIds.filter(id => !foundIds.includes(id.toString()));
        
        return NextResponse.json({ 
          error: 'Some points do not exist in the database',
          missingPoints: missingIds
        }, { status: 400 });
      }

      // Create route with points
      const route = await Route.create({
        name: data.name,
        points: pointIds,
        active: true,
        teams: [],
        settings: {
          penaltyTime: data.settings?.penaltyTime || 2,
          maxAttempts: data.settings?.maxAttempts || 3
        },
        includeAdvancedPoints: data.includeAdvancedPoints || false
      });
      
      // Return populated route
      const populatedRoute = await Route.findById(route._id)
        .populate({
          path: 'points',
          model: mongoose.models.Point,
          select: 'name code location question images isAdvanced isFinishPoint'
        })
        .lean()
        .exec();

      return NextResponse.json(populatedRoute);
    }
  } catch (error) {
    console.error('Error creating route:', error);
    return NextResponse.json({ 
      error: 'Failed to create route', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointModel.schema);
    }
    
    // Make sure Route model is registered
    if (!mongoose.models.Route) {
      mongoose.model('Route', RouteModel.schema);
    }
    
    const data = await request.json();
    const { _id, ...updateData } = data;
    
    // Validate that points exist if they're being updated
    if (updateData.points && (!Array.isArray(updateData.points) || updateData.points.length === 0)) {
      return NextResponse.json({ 
        error: 'Route must have at least one point',
      }, { status: 400 });
    }

    // If points are being updated, verify they exist in the database
    if (updateData.points && Array.isArray(updateData.points) && updateData.points.length > 0) {
      const pointIds = updateData.points.map(pointId => 
        typeof pointId === 'string' ? pointId : pointId._id
      );
      
      const foundPoints = await PointModel.find({
        _id: { $in: pointIds }
      });
      
      if (foundPoints.length !== pointIds.length) {
        const foundIds = foundPoints.map(point => point._id.toString());
        const missingIds = pointIds.filter(id => !foundIds.includes(id.toString()));
        
        return NextResponse.json({ 
          error: 'Some points do not exist in the database',
          missingPoints: missingIds
        }, { status: 400 });
      }
      
      // Update the points array to use the IDs
      updateData.points = pointIds;
    }

    const route = await Route.findByIdAndUpdate(
      _id,
      updateData,
      { new: true }
    )
    .populate({
      path: 'points',
      model: mongoose.models.Point,
      select: 'name code location question'
    })
    .lean()
    .exec();

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    
    return NextResponse.json(route);
  } catch (error) {
    console.error('Error updating route:', error);
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    
    // Make sure Point model is registered
    if (!mongoose.models.Point) {
      mongoose.model('Point', PointModel.schema);
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }
    
    const route = await Route.findByIdAndDelete(id)
      .populate({
        path: 'points',
        model: mongoose.models.Point,
        select: 'name code location question'
      })
      .lean()
      .exec();

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 });
  }
} 