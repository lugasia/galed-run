import mongoose, { Schema } from 'mongoose';
import Point, { PointSchema } from './Point';

// Make sure Point model is registered
if (mongoose.models && !mongoose.models.Point) {
  mongoose.model('Point', PointSchema);
}

const RouteSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  points: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
  }],
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  settings: {
    penaltyTime: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },
  },
  active: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true
});

const Route = mongoose.models.Route || mongoose.model('Route', RouteSchema);
export default Route;
export { RouteSchema }; 