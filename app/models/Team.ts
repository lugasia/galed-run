import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  members: [{
    name: String,
    phone: String,
  }],
  currentRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  currentLocation: {
    type: {
      coordinates: [Number],
      timestamp: Date,
    },
    default: null,
  },
  visitedPoints: [{
    point: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Point',
    },
    timestamp: Date,
    attempts: Number,
  }],
  active: {
    type: Boolean,
    default: true,
  },
  uniqueLink: {
    type: String,
    unique: true,
  }
}, {
  timestamps: true
});

export default mongoose.models.Team || mongoose.model('Team', TeamSchema); 