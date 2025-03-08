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
  location: {
    type: [Number],
    required: true,
    validate: {
      validator: (v: number[]) => v.length === 2,
      message: 'Location must be [latitude, longitude]'
    }
  },
  question: {
    text: {
      type: String,
      default: '',
    },
    options: {
      type: [String],
      default: ['', '', '', ''],
    },
    correctAnswer: {
      type: String,
      default: '',
    }
  }
}, {
  timestamps: true
});

export default mongoose.models.Point || mongoose.model('Point', PointSchema); 