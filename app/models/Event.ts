import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  type: {
    type: String,
    enum: ['ROUTE_STARTED', 'ROUTE_COMPLETED'],
    required: true,
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true
});

export default mongoose.models.Event || mongoose.model('Event', EventSchema); 