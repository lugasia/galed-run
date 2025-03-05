import mongoose from 'mongoose';

const RouteSchema = new mongoose.Schema({
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

export default mongoose.models.Route || mongoose.model('Route', RouteSchema); 