import { Request, Response, NextFunction } from 'express';
import Order from '../models/Order';
import Restaurant from '../models/Restaurant';
import Table from '../models/Table';
import Cart from '../models/Cart';
import Customer from '../models/Customer';
import { NotificationService } from '../services/notificationService';
import { SocketService } from '../services/socketService';

// @desc    Create a new customer table order (Checkout)
// @route   POST /api/orders
// @access  Public
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { customerName, customerPhone, notes, tableNumber, sessionToken, restaurantId } = req.body;

    if (!customerName || !customerPhone || !tableNumber || !sessionToken || !restaurantId) {
      res.status(400).json({ success: false, error: 'Please provide all checkout details' });
      return;
    }

    // 1. Validate restaurant status
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found' });
      return;
    }

    if (!restaurant.isAvailable) {
      res.status(400).json({ success: false, error: 'Restaurant is currently closed. Cannot accept orders.' });
      return;
    }

    // 2. Validate table
    const table = await Table.findOne({ restaurantId, tableNumber });
    if (!table) {
      res.status(400).json({ success: false, error: `Invalid table number: ${tableNumber}` });
      return;
    }

    // 3. Double-submit prevention (Same table, phone, and name within 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const duplicateOrder = await Order.findOne({
      restaurantId,
      tableId: table._id,
      customerPhone,
      customerName,
      createdAt: { $gte: tenSecondsAgo }
    });

    if (duplicateOrder) {
      res.status(400).json({
        success: false,
        error: 'Duplicate order detected. Please wait a few seconds.'
      });
      return;
    }

    // 4. Fetch shopping cart
    const cart = await Cart.findOne({ sessionToken }).populate('items.menuItemId');
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ success: false, error: 'Your cart is empty. Please add items.' });
      return;
    }

    // 5. Lock pricing & validate stock/availability
    const orderItems: any[] = [];
    let grandTotal = 0;

    for (const item of cart.items) {
      const dbItem: any = item.menuItemId;
      
      if (!dbItem) {
        res.status(400).json({ success: false, error: 'One of the items in your cart is invalid' });
        return;
      }

      if (!dbItem.isAvailable) {
        res.status(400).json({ success: false, error: `"${dbItem.name}" is currently sold out / unavailable` });
        return;
      }

      // Security check: Lock item price from DB, never trust client input
      const activePrice = dbItem.discountPrice || dbItem.price;
      const subtotal = activePrice * item.quantity;
      
      grandTotal += subtotal;

      orderItems.push({
        menuItemId: dbItem._id,
        quantity: item.quantity,
        price: activePrice,
        subtotal
      });
    }

    // 6. Generate auto-incrementing orderNumber
    const prefix = restaurant.whatsappSettings?.orderPrefix || '#DIS';
    const lastOrder = await Order.findOne({ restaurantId }).sort({ createdAt: -1 });
    
    let nextNum = 1001;
    if (lastOrder && lastOrder.orderNumber) {
      const parts = lastOrder.orderNumber.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const orderNumber = `${prefix}-${nextNum}`;

    // Generate KDS 5-char token (e.g. #A102)
    const tokenLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randLetter = tokenLetters.charAt(Math.floor(Math.random() * tokenLetters.length));
    const randNumber = Math.floor(Math.random() * 900) + 100;
    const token = `#${randLetter}${randNumber}`;

    // 7. Save Order to Database
    const order = new Order({
      restaurantId,
      tableId: table._id,
      orderNumber,
      token,
      customerName,
      customerPhone,
      items: orderItems,
      grandTotal,
      notes,
      status: 'pending'
    });

    await order.save();

    // Asynchronously upsert customer records and update metrics (Non-blocking)
    updateCustomerStats(restaurantId.toString(), customerName, customerPhone, grandTotal, table._id.toString(), orderItems).catch(err => {
      console.error('Failed to update customer analytics statistics:', err);
    });

    // 8. Populate MenuItem and Table details for the receipt and WhatsApp notification
    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItemId', 'name')
      .populate('tableId', 'tableNumber');

    if (!populatedOrder) {
      res.status(500).json({ success: false, error: 'Failed to retrieve placed order details' });
      return;
    }

    // Broadcast Socket.IO new order event to restaurant dashboards/KDS
    SocketService.emitNewOrder(restaurantId, populatedOrder);

    // 9. Dispatch WhatsApp in background (non-blocking)
    if (restaurant.whatsappSettings?.autoSend) {
      NotificationService.sendNewOrderAlert(populatedOrder, restaurant).catch(err => {
        console.error('Failed to trigger auto WhatsApp alert:', err);
      });
    }

    // 10. Clear customer cart on successful checkout
    await Cart.findByIdAndDelete(cart._id);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: populatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders for restaurant dashboard
// @route   GET /api/orders
// @access  Private (Owner/Staff)
export const getRestaurantOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query: any = { restaurantId: req.user.restaurantId };

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .populate('items.menuItemId', 'name price imageUrl')
        .populate('tableId', 'tableNumber')
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum),
      Order.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        totalOrders,
        totalPages: Math.ceil(totalOrders / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Owner/Staff)
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const orderId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['pending', 'confirmed', 'preparing', 'completed', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      res.status(400).json({ success: false, error: 'Please provide a valid status transition' });
      return;
    }

    // Verify order belongs to this restaurant
    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.user.restaurantId
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    order.status = status as any;
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItemId', 'name price imageUrl')
      .populate('tableId', 'tableNumber');

    if (populatedOrder) {
      // Sync dashboard and guest tracking screens
      SocketService.emitOrderUpdated(order.restaurantId.toString(), order._id.toString(), populatedOrder);
    }

    res.status(200).json({
      success: true,
      order: populatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually trigger WhatsApp notification for an order
// @route   POST /api/orders/:id/notify
// @access  Private (Owner/Staff)
export const resendOrderNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const orderId = req.params.id;

    // Verify order
    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.user.restaurantId
    }).populate('items.menuItemId', 'name').populate('tableId', 'tableNumber');

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found' });
      return;
    }

    const sent = await NotificationService.sendNewOrderAlert(order, restaurant);

    if (sent) {
      res.status(200).json({ success: true, message: 'WhatsApp notification sent successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send WhatsApp message. Check configurations.' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update order priority status
// @route   PUT /api/orders/:id/priority
// @access  Private (Owner/Staff)
export const updateOrderPriority = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const orderId = req.params.id;
    const { priority } = req.body;

    const allowedPriorities = ['normal', 'vip', 'rush', 'delayed'];
    if (!priority || !allowedPriorities.includes(priority)) {
      res.status(400).json({ success: false, error: 'Please provide a valid priority level' });
      return;
    }

    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.user.restaurantId
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    order.priority = priority as any;
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItemId', 'name price imageUrl')
      .populate('tableId', 'tableNumber');

    if (populatedOrder) {
      // Sync dashboard and KDS instantly
      SocketService.emitOrderUpdated(order.restaurantId.toString(), order._id.toString(), populatedOrder);
    }

    res.status(200).json({
      success: true,
      order: populatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard order analytics
// @route   GET /api/orders/analytics
// @access  Private (Owner/Staff)
export const getOrderAnalytics = async (
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Fetch all active and completed orders for today
    const ordersToday = await Order.find({
      restaurantId,
      createdAt: { $gte: startOfToday }
    });

    const activeOrders = await Order.find({
      restaurantId,
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
    });

    const todayOrdersCount = ordersToday.length;
    
    // Revenue
    const todayRevenue = ordersToday
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.grandTotal, 0);

    const preparingCount = activeOrders.filter(o => o.status === 'preparing').length;
    const readyCount = activeOrders.filter(o => o.status === 'ready').length;
    const completedTodayCount = ordersToday.filter(o => o.status === 'completed').length;

    // Average preparation time (in minutes) for orders completed today
    const completedOrdersToday = ordersToday.filter(
      o => o.status === 'completed' && o.updatedAt && o.createdAt
    );
    let avgPrepTimeMins = 0;
    if (completedOrdersToday.length > 0) {
      const totalPrepTimeMs = completedOrdersToday.reduce((sum, o) => {
        const diffMs = o.updatedAt.getTime() - o.createdAt.getTime();
        return sum + diffMs;
      }, 0);
      avgPrepTimeMins = Math.round((totalPrepTimeMs / completedOrdersToday.length) / 60000);
    }

    // Longest waiting order (in minutes)
    let longestWaitMins = 0;
    if (activeOrders.length > 0) {
      const now = Date.now();
      const oldestActive = activeOrders.reduce((oldest, o) => {
        return o.createdAt.getTime() < oldest.createdAt.getTime() ? o : oldest;
      }, activeOrders[0]);
      longestWaitMins = Math.round((now - oldestActive.createdAt.getTime()) / 60000);
    }

    // Active tables count
    const uniqueTables = new Set(activeOrders.map(o => o.tableId.toString()));
    const activeTablesCount = uniqueTables.size;

    res.status(200).json({
      success: true,
      analytics: {
        todayOrders: todayOrdersCount,
        todayRevenue,
        preparingOrders: preparingCount,
        readyOrders: readyCount,
        completedOrders: completedTodayCount,
        averagePrepTime: avgPrepTimeMins || 15,
        longestWaiting: longestWaitMins,
        activeTables: activeTablesCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Asynchronously update Customer Profiling Stats (visits, spending, favorite items)
 */
async function updateCustomerStats(
  restaurantId: string,
  name: string,
  phone: string,
  grandTotal: number,
  tableId: string,
  items: any[]
): Promise<void> {
  try {
    // Find or create customer
    let customer = await Customer.findOne({ restaurantId, phone });
    if (!customer) {
      customer = new Customer({
        restaurantId,
        name,
        phone,
        totalVisits: 1,
        totalOrders: 1,
        lifetimeSpend: grandTotal,
        lastVisit: new Date(),
        preferredTable: tableId as any,
        averageOrderValue: grandTotal,
        favouriteItems: items.map(item => item.menuItemId)
      });
    } else {
      customer.totalVisits += 1;
      customer.totalOrders += 1;
      customer.lifetimeSpend += grandTotal;
      customer.lastVisit = new Date();
      customer.preferredTable = tableId as any;
      customer.averageOrderValue = Math.round((customer.lifetimeSpend / customer.totalOrders) * 100) / 100;
      
      // Update favorite item list: merge new items and keep them unique
      const existingFavs = customer.favouriteItems.map((id: any) => id.toString());
      const newItems = items.map(item => item.menuItemId.toString());
      const combinedFavs = Array.from(new Set([...existingFavs, ...newItems])).slice(0, 5); // Keep top 5
      customer.favouriteItems = combinedFavs as any;
    }
    
    await customer.save();
    console.log(`[Customer Aggregator] Synced stats for customer: ${phone} (Visits: ${customer.totalVisits})`);
  } catch (err) {
    console.error('Error in Customer Aggregation:', err);
  }
}
