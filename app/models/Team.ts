import mongoose, { Document, Schema } from 'mongoose';
import Point from './Point';
import Route from './Route';
import { motion } from 'framer-motion';

export interface ITeam extends Document {
  name: string;
  leaderName: string;
  uniqueLink: string;
  currentRoute: {
    _id: mongoose.Types.ObjectId;
    points: Array<{
      _id: mongoose.Types.ObjectId;
      name: string;
      code: string;
      location: [number, number];
      question: {
        text: string;
        options: string[];
        correctAnswer: string;
      };
    }>;
  };
  currentPointIndex: number;
  attempts: number;
  visitedPoints: mongoose.Types.ObjectId[];
  penaltyEndTime?: Date;
  startTime?: Date;
  currentLocation?: {
    type: string;
    coordinates: [number, number];
    timestamp: Date;
  };
}

const teamSchema = new Schema({
  name: { type: String, required: true },
  leaderName: { type: String, required: true },
  uniqueLink: { type: String, required: true, unique: true },
  currentRoute: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
  currentPointIndex: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  visitedPoints: [{ type: Schema.Types.ObjectId, ref: 'Point' }],
  penaltyEndTime: { type: Date },
  startTime: { type: Date },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined },
    timestamp: { type: Date }
  }
});

// Add index for geospatial queries
teamSchema.index({ 'currentLocation.coordinates': '2dsphere' });

export const Team = mongoose.models.Team || mongoose.model<ITeam>('Team', teamSchema); 