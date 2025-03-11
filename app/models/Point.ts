import mongoose, { Schema } from 'mongoose';

const PointSchema = new Schema({
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
  },
  images: {
    zoomIn: {
      type: String,
      default: '',
    },
    zoomOut: {
      type: String,
      default: '',
    }
  },
  isAdvanced: {
    type: Boolean,
    default: false,
  },
  isFinishPoint: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true
});

// Export both the model and the schema for registration in other files
const Point = mongoose.models.Point || mongoose.model('Point', PointSchema);
export default Point;
export { PointSchema }; 