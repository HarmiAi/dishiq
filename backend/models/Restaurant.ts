import { Schema, model, Document } from 'mongoose';

export interface IOpeningHour {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

export interface ISocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
}

export interface IOrderSettings {
  qrOrderingEnabled: boolean;
  whatsappOrderingEnabled: boolean;
}

export interface IWhatsappSettings {
  whatsappNumber: string;
  businessName: string;
  orderPrefix: string;
  notificationsEnabled: boolean;
  autoSend: boolean;
  timezone: string;
}

export interface IRestaurant extends Document {
  ownerId: Schema.Types.ObjectId;
  name: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  cuisine: string[];
  gstNumber?: string;
  socialLinks: ISocialLinks;
  openingHours: IOpeningHour[];
  isAvailable: boolean;
  isSuspended: boolean;
  orderSettings: IOrderSettings;
  whatsappSettings: IWhatsappSettings;
  createdAt: Date;
  updatedAt: Date;
}

const OpeningHourSchema = new Schema<IOpeningHour>({
  day: { type: String, required: true },
  open: { type: String, default: '09:00' },
  close: { type: String, default: '22:00' },
  isClosed: { type: Boolean, default: false }
}, { _id: false });

const RestaurantSchema = new Schema<IRestaurant>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Please provide restaurant name'],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    logoUrl: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    cuisine: {
      type: [String],
      default: []
    },
    gstNumber: {
      type: String,
      default: ''
    },
    socialLinks: {
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
      twitter: { type: String, default: '' }
    },
    openingHours: {
      type: [OpeningHourSchema],
      default: [
        { day: 'Monday', open: '09:00', close: '22:00', isClosed: false },
        { day: 'Tuesday', open: '09:00', close: '22:00', isClosed: false },
        { day: 'Wednesday', open: '09:00', close: '22:00', isClosed: false },
        { day: 'Thursday', open: '09:00', close: '22:00', isClosed: false },
        { day: 'Friday', open: '09:00', close: '22:00', isClosed: false },
        { day: 'Saturday', open: '09:00', close: '23:00', isClosed: false },
        { day: 'Sunday', open: '09:00', close: '23:00', isClosed: false }
      ]
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    isSuspended: {
      type: Boolean,
      default: false
    },
    orderSettings: {
      qrOrderingEnabled: { type: Boolean, default: true },
      whatsappOrderingEnabled: { type: Boolean, default: false }
    },
    whatsappSettings: {
      whatsappNumber: { type: String, default: '' },
      businessName: { type: String, default: '' },
      orderPrefix: { type: String, default: '#DIS' },
      notificationsEnabled: { type: Boolean, default: true },
      autoSend: { type: Boolean, default: true },
      timezone: { type: String, default: 'Asia/Kolkata' }
    }
  },
  {
    timestamps: true
  }
);

export default model<IRestaurant>('Restaurant', RestaurantSchema);
