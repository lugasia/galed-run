import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  question: { type: String, required: true },
  options: [{
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true }
  }],
  hints: [{
    text: { type: String, required: true },
    cost: { type: Number, required: true }
  }],
  image: { type: String },
  qrCode: { 
    type: String, 
    required: true,
    unique: true,
    description: 'QR code identifier for this point'
  },
  nextPointQrCode: {
    type: String,
    description: 'QR code identifier of the next point in the route'
  }
});

// Index for geospatial queries
pointSchema.index({ location: '2dsphere' });

export const Point = mongoose.models.Point || mongoose.model('Point', pointSchema); 