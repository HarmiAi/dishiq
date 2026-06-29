import { Schema, model, Document } from 'mongoose';

export interface ICustomer extends Document {
  restaurantId: Schema.Types.ObjectId;
  name: string;
  phone: string;
  totalVisits: number;
  totalOrders: number;
  lifetimeSpend: number;
  favouriteItems: Schema.Types.ObjectId[];
  lastVisit: Date;
  averageOrderValue: number;
  preferredTable?: Schema.Types.ObjectId;
  notes?: string;
  isVIP: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    totalVisits: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    lifetimeSpend: {
      type: Number,
      default: 0
    },
    favouriteItems: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MenuItem'
      }
    ],
    lastVisit: {
      type: Date,
      default: Date.now
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    preferredTable: {
      type: Schema.Types.ObjectId,
      ref: 'Table'
    },
    notes: {
      type: String,
      default: ''
    },
    isVIP: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index to guarantee uniqueness of customer contacts per restaurant
CustomerSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });

export default model<ICustomer>('Customer', CustomerSchema);
