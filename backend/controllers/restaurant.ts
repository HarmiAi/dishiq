import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';

// @desc    Get dashboard stats for current restaurant
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const restaurantId = req.user.restaurantId;

    // Run queries in parallel for efficiency
    const [totalMenuItems, totalTables, restaurant] = await Promise.all([
      MenuItem.countDocuments({ restaurantId }),
      Table.countDocuments({ restaurantId }),
      Restaurant.findById(restaurantId).select('isAvailable name slug')
    ]);

    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found' });
      return;
    }

    res.status(200).json({
      success: true,
      stats: {
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        totalMenuItems,
        totalTables,
        isAvailable: restaurant.isAvailable
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update restaurant profile settings
// @route   PUT /api/restaurant
// @access  Private
export const updateRestaurant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const restaurantId = req.user.restaurantId;

    // Filter fields to avoid unauthorized modification of ownerId/slug
    const {
      name,
      address,
      phone,
      email,
      cuisine,
      gstNumber,
      socialLinks,
      openingHours,
      logoUrl,
      orderSettings,
      whatsappSettings
    } = req.body;

    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (address !== undefined) updateFields.address = address;
    if (phone !== undefined) updateFields.phone = phone;
    if (email !== undefined) updateFields.email = email;
    if (cuisine !== undefined) updateFields.cuisine = cuisine;
    if (gstNumber !== undefined) updateFields.gstNumber = gstNumber;
    if (socialLinks !== undefined) updateFields.socialLinks = socialLinks;
    if (openingHours !== undefined) updateFields.openingHours = openingHours;
    if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;
    if (orderSettings !== undefined) updateFields.orderSettings = orderSettings;
    if (whatsappSettings !== undefined) updateFields.whatsappSettings = whatsappSettings;

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      restaurant: updatedRestaurant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle restaurant availability status
// @route   PUT /api/restaurant/status
// @access  Private
export const toggleRestaurantStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const restaurantId = req.user.restaurantId;
    const { isAvailable } = req.body;

    if (isAvailable === undefined) {
      res.status(400).json({ success: false, error: 'Please provide isAvailable status' });
      return;
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: { isAvailable } },
      { new: true }
    ).select('isAvailable name');

    res.status(200).json({
      success: true,
      isAvailable: updatedRestaurant?.isAvailable
    });
  } catch (error) {
    next(error);
  }
};
