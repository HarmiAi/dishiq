import { Request, Response, NextFunction } from 'express';
import Table from '../models/Table';
import Restaurant from '../models/Restaurant';

// @desc    Get all tables for current restaurant
// @route   GET /api/tables
// @access  Private
export const getTables = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const tables = await Table.find({
      restaurantId: req.user.restaurantId
    }).sort({ tableNumber: 1 });

    res.status(200).json({
      success: true,
      tables
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a table and generate QR code link
// @route   POST /api/tables
// @access  Private
export const createTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const { tableNumber, capacity } = req.body;

    if (!tableNumber) {
      res.status(400).json({ success: false, error: 'Table number is required' });
      return;
    }

    // Check if table number already exists
    const tableExists = await Table.findOne({
      restaurantId: req.user.restaurantId,
      tableNumber
    });

    if (tableExists) {
      res.status(400).json({ success: false, error: 'Table number already exists' });
      return;
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found' });
      return;
    }

    // Generate menu order link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const orderLink = `${frontendUrl}/r/${restaurant.slug}?table=${tableNumber}`;
    
    // Dynamic QR code generation API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(orderLink)}`;

    const table = new Table({
      restaurantId: req.user.restaurantId,
      tableNumber,
      capacity: capacity || 2,
      qrCodeUrl,
      status: 'vacant'
    });

    await table.save();

    res.status(201).json({
      success: true,
      table
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a table
// @route   PUT /api/tables/:id
// @access  Private
export const updateTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const tableId = req.params.id;
    const { tableNumber, capacity, status } = req.body;

    // Verify table belongs to this restaurant
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: req.user.restaurantId
    });

    if (!table) {
      res.status(404).json({ success: false, error: 'Table not found' });
      return;
    }

    if (tableNumber && tableNumber !== table.tableNumber) {
      // Check duplicate
      const duplicateExists = await Table.findOne({
        restaurantId: req.user.restaurantId,
        tableNumber
      });
      if (duplicateExists) {
        res.status(400).json({ success: false, error: 'Table number already exists' });
        return;
      }
      
      table.tableNumber = tableNumber;

      // Update QR Code
      const restaurant = await Restaurant.findById(req.user.restaurantId);
      if (restaurant) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const orderLink = `${frontendUrl}/r/${restaurant.slug}?table=${tableNumber}`;
        table.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(orderLink)}`;
      }
    }

    if (capacity !== undefined) table.capacity = capacity;
    if (status !== undefined) table.status = status;

    await table.save();

    res.status(200).json({
      success: true,
      table
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a table
// @route   DELETE /api/tables/:id
// @access  Private
export const deleteTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const tableId = req.params.id;

    // Verify table belongs to this restaurant
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: req.user.restaurantId
    });

    if (!table) {
      res.status(404).json({ success: false, error: 'Table not found' });
      return;
    }

    await Table.findByIdAndDelete(tableId);

    res.status(200).json({
      success: true,
      message: 'Table deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
