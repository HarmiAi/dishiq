import { Request, Response, NextFunction } from 'express';
import Customer from '../models/Customer';
import Order from '../models/Order';

// @desc    Get all customers for restaurant directory (Search, VIP filters, pagination)
// @route   GET /api/customers
// @access  Private (Owner/Manager/Staff)
export const getCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const { search, vipOnly, page = 1, limit = 10 } = req.query;
    const query: any = { restaurantId: req.user.restaurantId };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // VIP filter
    if (vipOnly === 'true') {
      query.isVIP = true;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ lastVisit: -1 })
        .skip(skipNum)
        .limit(limitNum),
      Customer.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      customers,
      pagination: {
        totalCustomers: total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer details including order history timeline
// @route   GET /api/customers/:id
// @access  Private (Owner/Manager/Staff)
export const getCustomerDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const customerId = req.params.id;
    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: req.user.restaurantId
    }).populate('favouriteItems', 'name price');

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer profile not found' });
      return;
    }

    // Fetch order history timeline for this customer
    const orderHistory = await Order.find({
      restaurantId: req.user.restaurantId,
      customerPhone: customer.phone
    })
      .sort({ createdAt: -1 })
      .populate('items.menuItemId', 'name price');

    res.status(200).json({
      success: true,
      customer,
      orderHistory
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle customer VIP status
// @route   PUT /api/customers/:id/vip
// @access  Private (Owner/Manager)
export const toggleCustomerVIP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const customerId = req.params.id;
    const { isVIP } = req.body;

    if (typeof isVIP !== 'boolean') {
      res.status(400).json({ success: false, error: 'Please provide isVIP boolean status' });
      return;
    }

    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: req.user.restaurantId
    });

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    customer.isVIP = isVIP;
    await customer.save();

    res.status(200).json({
      success: true,
      message: `Customer VIP status set to ${isVIP}`,
      customer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer special kitchen notes
// @route   PUT /api/customers/:id/notes
// @access  Private (Owner/Manager/Staff)
export const updateCustomerNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const customerId = req.params.id;
    const { notes } = req.body;

    if (notes === undefined) {
      res.status(400).json({ success: false, error: 'Please provide notes content' });
      return;
    }

    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: req.user.restaurantId
    });

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    customer.notes = notes;
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer notes updated successfully',
      customer
    });
  } catch (error) {
    next(error);
  }
};
