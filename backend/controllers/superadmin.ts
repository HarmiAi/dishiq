import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant';
import Order from '../models/Order';
import Customer from '../models/Customer';
import User from '../models/User';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';

// @desc    Get global SaaS platform stats
// @route   GET /api/superadmin/stats
// @access  Private (SuperAdmin)
export const getPlatformStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      totalOrders,
      totalCustomers
    ] = await Promise.all([
      Restaurant.countDocuments({}),
      Restaurant.countDocuments({ isSuspended: false }),
      Restaurant.countDocuments({ isSuspended: true }),
      Order.countDocuments({}),
      Customer.countDocuments({})
    ]);

    // Sum revenue from all completed orders globally
    const revenueStats = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' } } }
    ]);
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;

    // Get 5 most recent restaurant registrations
    const recentRestaurants = await Restaurant.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('ownerId', 'email');

    res.status(200).json({
      success: true,
      stats: {
        totalRestaurants,
        activeRestaurants,
        suspendedRestaurants,
        totalOrders,
        totalCustomers,
        totalRevenue,
        recentRestaurants
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated, searchable list of all restaurants
// @route   GET /api/superadmin/restaurants
// @access  Private (SuperAdmin)
export const getRestaurants = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      if (status === 'active') query.isSuspended = false;
      if (status === 'suspended') query.isSuspended = true;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const [restaurants, total] = await Promise.all([
      Restaurant.find(query)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .populate('ownerId', 'email'),
      Restaurant.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      restaurants,
      pagination: {
        totalRestaurants: total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle restaurant suspension status
// @route   PUT /api/superadmin/restaurants/:id/suspend
// @access  Private (SuperAdmin)
export const toggleRestaurantStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.params.id;
    const { isSuspended } = req.body;

    if (typeof isSuspended !== 'boolean') {
      res.status(400).json({ success: false, error: 'Please provide isSuspended boolean status' });
      return;
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found' });
      return;
    }

    restaurant.isSuspended = isSuspended;
    await restaurant.save();

    res.status(200).json({
      success: true,
      message: `Restaurant is now ${isSuspended ? 'suspended' : 'active'}`,
      restaurant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete restaurant and cascade clean all related resources
// @route   DELETE /api/superadmin/restaurants/:id
// @access  Private (SuperAdmin)
export const deleteRestaurant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.params.id;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found' });
      return;
    }

    // Cascade delete restaurant entities
    await Promise.all([
      Category.deleteMany({ restaurantId }),
      MenuItem.deleteMany({ restaurantId }),
      Table.deleteMany({ restaurantId }),
      Order.deleteMany({ restaurantId }),
      Customer.deleteMany({ restaurantId }),
      User.deleteMany({ restaurantId }), // delete linked staff accounts
      User.findByIdAndDelete(restaurant.ownerId), // delete owner profile
      Restaurant.findByIdAndDelete(restaurantId) // delete restaurant itself
    ]);

    res.status(200).json({
      success: true,
      message: 'Restaurant profile and all associated data records successfully deleted'
    });
  } catch (error) {
    next(error);
  }
};
