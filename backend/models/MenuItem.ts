import { Schema, model, Document } from 'mongoose';

export interface IMenuItem extends Document {
  restaurantId: Schema.Types.ObjectId;
  categoryId: Schema.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
  isVeg: boolean;
  isAvailable: boolean;
  preparationTime?: number; // in minutes
  spiceLevel: 'low' | 'medium' | 'high';
  isPopular: boolean;
  isFeatured: boolean;
  modelUrl?: string;
  previewImage?: string;
  thumbnail?: string;
  modelScale?: number;
  rotation?: number;
  lightingPreset?: string;
  shadowIntensity?: number;
  boundingBox?: {
    width: number;
    height: number;
    depth: number;
  };
  polygonCount?: number;
  textureResolution?: string;
  compressed?: boolean;
  previewGenerated?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Please provide item name'],
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    price: {
      type: Number,
      required: [true, 'Please provide item price'],
      min: [0, 'Price cannot be negative']
    },
    discountPrice: {
      type: Number,
      validate: {
        validator: function(this: IMenuItem, val: number) {
          return !val || val < this.price;
        },
        message: 'Discount price must be less than regular price'
      }
    },
    imageUrl: {
      type: String,
      default: ''
    },
    isVeg: {
      type: Boolean,
      default: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    preparationTime: {
      type: Number,
      default: 15 // minutes default
    },
    spiceLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    isPopular: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    modelUrl: {
      type: String,
      default: ''
    },
    previewImage: {
      type: String,
      default: ''
    },
    thumbnail: {
      type: String,
      default: ''
    },
    modelScale: {
      type: Number,
      default: 1.0
    },
    rotation: {
      type: Number,
      default: 0
    },
    lightingPreset: {
      type: String,
      default: 'default'
    },
    shadowIntensity: {
      type: Number,
      default: 0.5
    },
    boundingBox: {
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      depth: { type: Number, default: 0 }
    },
    polygonCount: {
      type: Number,
      default: 0
    },
    textureResolution: {
      type: String,
      default: ''
    },
    compressed: {
      type: Boolean,
      default: false
    },
    previewGenerated: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default model<IMenuItem>('MenuItem', MenuItemSchema);
