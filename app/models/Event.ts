import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  type: {
    type: String,
    enum: ['POINT_REACHED', 'QUESTION_ANSWERED', 'ROUTE_STARTED', 'ROUTE_COMPLETED', 'PENALTY_APPLIED'],
    required: true,
  },
  point: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  location: {
    type: {
      coordinates: [Number],
    },
    default: null,
  }
}, {
  timestamps: true
});

export default mongoose.models.Event || mongoose.model('Event', EventSchema); 