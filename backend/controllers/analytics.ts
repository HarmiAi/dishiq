import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Customer from '../models/Customer';

// @desc    Get detailed restaurant analytics for dashboard widgets & SVG charts
// @route   GET /api/analytics
// @access  Private (Owner/Manager)
export const getRestaurantAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const restaurantId = new mongoose.Types.ObjectId(req.user.restaurantId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Calculate General Aggregated Stats (Revenue & Orders)
    const [revenueStatsToday, revenueStatsWeek, revenueStatsMonth, generalStats] = await Promise.all([
      Order.aggregate([
        { $match: { restaurantId, status: 'completed', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { restaurantId, status: 'completed', createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Order.aggregate([
        { $match: { restaurantId, status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Order.aggregate([
        { $match: { restaurantId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$grandTotal', 0] } }
          }
        }
      ])
    ]);

    const todayRevenue = revenueStatsToday.length > 0 ? revenueStatsToday[0].total : 0;
    const todayOrdersCount = revenueStatsToday.length > 0 ? revenueStatsToday[0].count : 0;
    const weekRevenue = revenueStatsWeek.length > 0 ? revenueStatsWeek[0].total : 0;
    const monthRevenue = revenueStatsMonth.length > 0 ? revenueStatsMonth[0].total : 0;

    const gStats = generalStats.length > 0 ? generalStats[0] : { totalOrders: 0, completedOrders: 0, cancelledOrders: 0, totalRevenue: 0 };
    const averageOrderValue = gStats.completedOrders > 0 ? Math.round((gStats.totalRevenue / gStats.completedOrders) * 100) / 100 : 0;
    const cancelledPercentage = gStats.totalOrders > 0 ? Math.round((gStats.cancelledOrders / gStats.totalOrders) * 100) : 0;

    // 2. 30-Day Daily Sales (Line & Area Chart)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailySales = await Order.aggregate([
      {
        $match: {
          restaurantId,
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$grandTotal' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Hourly Peak Traffic Heatmap (Bar Chart)
    const hourlyTraffic = await Order.aggregate([
      { $match: { restaurantId, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format hourly traffic to ensure all 24 hours exist
    const hourlyFormatted = Array.from({ length: 24 }, (_, hour) => {
      const match = hourlyTraffic.find(h => h._id === hour);
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        orders: match ? match.orders : 0
      };
    });

    // 4. Most Selling Items (Pie Chart & Cards)
    const popularItems = await Order.aggregate([
      { $match: { restaurantId, status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItemId',
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'menuitems',
          localField: '_id',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: '$menuItem' },
      {
        $project: {
          _id: 1,
          name: '$menuItem.name',
          quantitySold: 1,
          revenue: 1,
          imageUrl: '$menuItem.imageUrl'
        }
      }
    ]);

    // 5. Category distribution percentage
    const categorySales = await Order.aggregate([
      { $match: { restaurantId, status: 'completed' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'items.menuItemId',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: '$menuItem' },
      {
        $lookup: {
          from: 'categories',
          localField: 'menuItem.categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          revenue: { $sum: '$items.subtotal' },
          quantity: { $sum: '$items.quantity' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // 6. Returning Customer Ratio
    const totalCustomers = await Customer.countDocuments({ restaurantId });
    const repeatCustomers = await Customer.countDocuments({ restaurantId, totalOrders: { $gt: 1 } });
    const returningPercentage = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    // 7. Average wait times
    const completedOrdersToday = await Order.find({
      restaurantId,
      status: 'completed',
      createdAt: { $gte: startOfMonth }
    });
    let avgPrepTimeMins = 0;
    if (completedOrdersToday.length > 0) {
      const totalPrepTimeMs = completedOrdersToday.reduce((sum, o) => {
        return sum + (o.updatedAt.getTime() - o.createdAt.getTime());
      }, 0);
      avgPrepTimeMins = Math.round((totalPrepTimeMs / completedOrdersToday.length) / 60000);
    }

    // 8. Generate Smart Business Insights
    const insights = [];
    
    // Busy Day Calculation
    const weekdayOrders = await Order.aggregate([
      { $match: { restaurantId, status: 'completed' } },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { orders: -1 } }
    ]);
    
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (weekdayOrders.length > 0) {
      const peakDayNum = weekdayOrders[0]._id - 1; // 1-indexed to 0-indexed
      const slowDayNum = weekdayOrders[weekdayOrders.length - 1]._id - 1;
      insights.push({
        type: 'traffic',
        title: 'Peak Seating Cycles',
        text: `Your busiest day of the week is ${daysMap[peakDayNum]} while ${daysMap[slowDayNum]} sees the lowest traffic.`
      });
    }

    if (popularItems.length > 0) {
      insights.push({
        type: 'revenue',
        title: 'Top Performing Asset',
        text: `The dish "${popularItems[0].name}" has generated the highest volume of order completions today.`
      });
    }

    if (returningPercentage > 15) {
      insights.push({
        type: 'loyalty',
        title: 'Brand Retention',
        text: `${returningPercentage}% of your active guest network are repeat diners, indicating high menu satisfaction.`
      });
    } else {
      insights.push({
        type: 'loyalty',
        title: 'Network Expansion',
        text: `Customer return rate is at ${returningPercentage}%. Try launching a loyalty campaign to increase repeats.`
      });
    }

    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          todayRevenue,
          todayOrders: todayOrdersCount,
          weekRevenue,
          monthRevenue,
          totalRevenue: gStats.totalRevenue,
          totalOrders: gStats.totalOrders,
          completedOrders: gStats.completedOrders,
          cancelledOrders: gStats.cancelledOrders,
          averageOrderValue,
          cancelledPercentage,
          returningPercentage,
          averagePrepTime: avgPrepTimeMins || 15
        },
        dailySales,
        hourlyTraffic: hourlyFormatted,
        popularItems,
        categorySales,
        insights
      }
    });
  } catch (error) {
    next(error);
  }
};
