import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  points: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Point',
    required: true
  }],
  startPointQrCode: {
    type: String,
    required: true,
    description: 'QR code of the first point in the route'
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
routeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Route = mongoose.models.Route || mongoose.model('Route', routeSchema); 