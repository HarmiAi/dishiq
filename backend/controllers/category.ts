import { Request, Response, NextFunction } from 'express';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';

// @desc    Get all categories for current restaurant
// @route   GET /api/categories
// @access  Private
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const categories = await Category.find({
      restaurantId: req.user.restaurantId
    }).sort({ sortOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const { name, description, sortOrder } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Category name is required' });
      return;
    }

    const category = new Category({
      restaurantId: req.user.restaurantId,
      name,
      description,
      sortOrder: sortOrder || 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const { name, description, sortOrder } = req.body;
    const categoryId = req.params.id;

    // Verify category belongs to this restaurant
    const category = await Category.findOne({
      _id: categoryId,
      restaurantId: req.user.restaurantId
    });

    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;

    await category.save();

    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a category and cascade delete its menu items
// @route   DELETE /api/categories/:id
// @access  Private
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const categoryId = req.params.id;

    // Verify category belongs to this restaurant
    const category = await Category.findOne({
      _id: categoryId,
      restaurantId: req.user.restaurantId
    });

    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    // Cascade delete associated menu items
    await MenuItem.deleteMany({ categoryId });

    // Delete category
    await Category.findByIdAndDelete(categoryId);

    res.status(200).json({
      success: true,
      message: 'Category and all associated menu items deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
