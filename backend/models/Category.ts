import { Schema, model, Document } from 'mongoose';

export interface ICategory extends Document {
  restaurantId: Schema.Types.ObjectId;
  name: string;
  description?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Please provide category name'],
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export default model<ICategory>('Category', CategorySchema);
