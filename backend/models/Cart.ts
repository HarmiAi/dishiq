import { Schema, model, Document } from 'mongoose';

export interface ICartItem {
  menuItemId: Schema.Types.ObjectId;
  quantity: number;
  notes?: string;
}

export interface ICart extends Document {
  tableId?: Schema.Types.ObjectId;
  restaurantId: Schema.Types.ObjectId;
  items: ICartItem[];
  sessionToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  menuItemId: {
    type: Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  notes: {
    type: String,
    default: ''
  }
}, { _id: false });

const CartSchema = new Schema<ICart>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table'
    },
    items: [CartItemSchema],
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Expire carts after 24 hours of inactivity to keep database clean
CartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export default model<ICart>('Cart', CartSchema);
