import { Request, Response, NextFunction } from 'express';
import Restaurant from '../models/Restaurant';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';
import Cart from '../models/Cart';
import Order from '../models/Order';
import ArAnalytics from '../models/ArAnalytics';

// @desc    Get public menu details by restaurant slug
// @route   GET /api/public/restaurant/:slug
// @access  Public
export const getPublicMenu = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    const restaurant = await Restaurant.findOne({ slug, isAvailable: true }).select(
      'name slug logoUrl address phone email cuisine openingHours orderSettings'
    );

    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant menu is currently offline or not found' });
      return;
    }

    const restaurantId = restaurant._id;

    // Fetch active categories and menu items
    const [categories, items] = await Promise.all([
      Category.find({ restaurantId }).sort({ sortOrder: 1, createdAt: 1 }),
      MenuItem.find({ restaurantId, isAvailable: true }).populate('categoryId', 'name')
    ]);

    // Check if table query param is passed to verify table existence
    let resolvedTable = null;
    const { table } = req.query;
    if (table) {
      resolvedTable = await Table.findOne({
        restaurantId,
        tableNumber: table as string
      }).select('tableNumber status capacity');
    }

    res.status(200).json({
      success: true,
      restaurant,
      categories,
      items,
      table: resolvedTable
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public cart by session token
// @route   GET /api/public/cart/:sessionToken
// @access  Public
export const getPublicCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionToken } = req.params;

    if (!sessionToken) {
      res.status(400).json({ success: false, error: 'Session token is required' });
      return;
    }

    const cart = await Cart.findOne({ sessionToken }).populate({
      path: 'items.menuItemId',
      select: 'name price discountPrice imageUrl isVeg isAvailable'
    });

    res.status(200).json({
      success: true,
      cart: cart || { items: [] }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update cart items for a customer session
// @route   POST /api/public/cart
// @access  Public
export const updatePublicCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionToken, restaurantId, tableNumber, items } = req.body;

    if (!sessionToken || !restaurantId || !items) {
      res.status(400).json({ success: false, error: 'Please provide sessionToken, restaurantId, and items' });
      return;
    }

    // Convert tableNumber string to Table ObjectId if available
    let tableId: any = undefined;
    if (tableNumber) {
      const tableRecord = await Table.findOne({ restaurantId, tableNumber });
      if (tableRecord) {
        tableId = tableRecord._id as any;
      }
    }

    // Find existing cart or create a new one
    let cart = await Cart.findOne({ sessionToken });

    if (cart) {
      cart.items = items;
      if (tableId) cart.tableId = tableId;
      await cart.save();
    } else {
      cart = new Cart({
        sessionToken,
        restaurantId,
        tableId,
        items
      });
      await cart.save();
    }

    const populatedCart = await Cart.findById(cart._id).populate({
      path: 'items.menuItemId',
      select: 'name price discountPrice imageUrl isVeg isAvailable'
    });

    res.status(200).json({
      success: true,
      cart: populatedCart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order details for guest tracking
// @route   GET /api/public/order/:id
// @access  Public
export const getPublicOrderDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('items.menuItemId', 'name price imageUrl')
      .populate('restaurantId', 'name logoUrl slug')
      .populate('tableId', 'tableNumber');

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Track WebXR AR Table Preview session metrics
// @route   POST /api/public/analytics/ar
// @access  Public
export const trackARSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { restaurantId, duration, itemsCount, uniqueItemIds, converted } = req.body;

    if (!restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant ID is required for logging' });
      return;
    }

    const logEntry = new ArAnalytics({
      restaurantId,
      duration: duration || 0,
      itemsCount: itemsCount || 0,
      uniqueItemIds: uniqueItemIds || [],
      converted: converted || false
    });

    await logEntry.save();

    res.status(201).json({
      success: true,
      message: 'AR session analytics captured successfully'
    });
  } catch (error) {
    next(error);
  }
};
