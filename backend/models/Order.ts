import { Schema, model, Document } from 'mongoose';

export interface IOrderItem {
  menuItemId: Schema.Types.ObjectId;
  quantity: number;
  price: number; // Price locked at checkout
  subtotal: number;
}

export interface IOrder extends Document {
  restaurantId: Schema.Types.ObjectId;
  tableId: Schema.Types.ObjectId;
  orderNumber: string;
  token: string;
  customerName: string;
  customerPhone: string;
  items: IOrderItem[];
  grandTotal: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  priority: 'normal' | 'vip' | 'rush' | 'delayed';
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  menuItemId: {
    type: Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  }
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true
    },
    orderNumber: {
      type: String,
      required: true,
      index: true
    },
    customerName: {
      type: String,
      required: [true, 'Please provide customer name'],
      trim: true
    },
    customerPhone: {
      type: String,
      required: [true, 'Please provide customer phone number'],
      trim: true
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (val: IOrderItem[]) => val.length > 0,
        message: 'Order must contain at least one item'
      }
    },
    grandTotal: {
      type: Number,
      required: true,
      min: [0, 'Grand total cannot be negative']
    },
    notes: {
      type: String,
      default: ''
    },
    token: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: ['normal', 'vip', 'rush', 'delayed'],
      default: 'normal',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index to quickly find orders by restaurant and status/creation time
OrderSchema.index({ restaurantId: 1, createdAt: -1 });

export default model<IOrder>('Order', OrderSchema);
