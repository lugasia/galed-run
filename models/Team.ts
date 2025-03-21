import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  uniqueLink: { type: String, required: true, unique: true },
  currentRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  startTime: { type: Date },
  completionTime: { type: Number },
  completedAt: { type: Date },
  active: { type: Boolean, default: true },
  visitedPoints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point'
  }],
  currentPointQrCode: {
    type: String,
    description: 'QR code of the current point the team is at'
  },
  hintsUsed: [{
    point: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Point'
    },
    hintIndex: Number,
    cost: Number
  }],
  totalPenaltyTime: { type: Number, default: 0 }
});

export const Team = mongoose.models.Team || mongoose.model('Team', teamSchema); 