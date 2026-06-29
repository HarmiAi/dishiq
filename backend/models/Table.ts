import { Schema, model, Document } from 'mongoose';

export interface ITable extends Document {
  restaurantId: Schema.Types.ObjectId;
  tableNumber: string;
  capacity: number;
  qrCodeUrl?: string;
  status: 'vacant' | 'occupied' | 'ordered';
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    tableNumber: {
      type: String,
      required: [true, 'Please provide table number'],
      trim: true
    },
    capacity: {
      type: Number,
      required: [true, 'Please provide table capacity'],
      min: [1, 'Capacity must be at least 1'],
      default: 2
    },
    qrCodeUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['vacant', 'occupied', 'ordered'],
      default: 'vacant'
    }
  },
  {
    timestamps: true
  }
);

// Ensure tableNumber is unique per restaurant
TableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

export default model<ITable>('Table', TableSchema);
