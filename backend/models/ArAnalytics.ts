import mongoose, { Schema, Document } from 'mongoose';

export interface IArAnalytics extends Document {
  restaurantId: mongoose.Types.ObjectId;
  duration: number; // Seconds in WebXR
  itemsCount: number; // Placed meshes count
  uniqueItemIds: mongoose.Types.ObjectId[]; // Placed MenuItem list
  converted: boolean; // Add-to-cart clicks conversion
  createdAt: Date;
}

const ArAnalyticsSchema = new Schema<IArAnalytics>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true
    },
    duration: {
      type: Number,
      default: 0
    },
    itemsCount: {
      type: Number,
      default: 0
    },
    uniqueItemIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MenuItem'
      }
    ],
    converted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.models.ArAnalytics ||
  mongoose.model<IArAnalytics>('ArAnalytics', ArAnalyticsSchema);
