import mongoose from 'mongoose';

const PointSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (v: number[]) => v.length === 2,
      message: 'Coordinates must be [latitude, longitude]'
    }
  },
  question: {
    text: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: String,
      required: true,
    }
  }
}, {
  timestamps: true
});

export default mongoose.models.Point || mongoose.model('Point', PointSchema); 