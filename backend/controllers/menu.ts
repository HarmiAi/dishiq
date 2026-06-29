import { Request, Response, NextFunction } from 'express';
import MenuItem from '../models/MenuItem';
import Category from '../models/Category';

// @desc    Get all menu items for current restaurant (with filters, pagination, sort, search)
// @route   GET /api/menu-items
// @access  Private
export const getMenuItems = async (
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
    const {
      search,
      categoryId,
      isVeg,
      isAvailable,
      sort,
      page = 1,
      limit = 10
    } = req.query;

    const query: any = { restaurantId };

    // Search query filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // Veg/Non-Veg filter
    if (isVeg !== undefined) {
      query.isVeg = isVeg === 'true';
    }

    // Availability filter
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    // Pagination values
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skipNum = (pageNum - 1) * limitNum;

    // Sorting options
    let sortOption: any = { createdAt: -1 }; // default newest
    if (sort) {
      switch (sort as string) {
        case 'priceAsc':
          sortOption = { price: 1 };
          break;
        case 'priceDesc':
          sortOption = { price: -1 };
          break;
        case 'nameAsc':
          sortOption = { name: 1 };
          break;
        case 'nameDesc':
          sortOption = { name: -1 };
          break;
        case 'newest':
          sortOption = { createdAt: -1 };
          break;
        default:
          sortOption = { createdAt: -1 };
      }
    }

    // Execute queries in parallel
    const [items, totalItems] = await Promise.all([
      MenuItem.find(query)
        .populate('categoryId', 'name')
        .sort(sortOption)
        .skip(skipNum)
        .limit(limitNum),
      MenuItem.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      items,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a menu item
// @route   POST /api/menu-items
// @access  Private
export const createMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const {
      categoryId,
      name,
      description,
      price,
      discountPrice,
      imageUrl,
      isVeg,
      isAvailable,
      preparationTime,
      spiceLevel,
      isPopular,
      isFeatured,
      modelUrl,
      previewImage,
      thumbnail,
      modelScale,
      rotation,
      lightingPreset,
      shadowIntensity,
      boundingBox,
      polygonCount,
      textureResolution,
      compressed,
      previewGenerated
    } = req.body;

    if (!categoryId || !name || price === undefined) {
      res.status(400).json({ success: false, error: 'Please provide category, name, and price' });
      return;
    }

    // Verify category belongs to this restaurant
    const categoryExists = await Category.findOne({
      _id: categoryId,
      restaurantId: req.user.restaurantId
    });

    if (!categoryExists) {
      res.status(400).json({ success: false, error: 'Invalid category for this restaurant' });
      return;
    }

    const menuItem = new MenuItem({
      restaurantId: req.user.restaurantId,
      categoryId,
      name,
      description,
      price,
      discountPrice,
      imageUrl,
      isVeg: isVeg !== undefined ? isVeg : true,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      preparationTime,
      spiceLevel,
      isPopular: isPopular || false,
      isFeatured: isFeatured || false,
      modelUrl: modelUrl || '',
      previewImage: previewImage || '',
      thumbnail: thumbnail || '',
      modelScale: modelScale !== undefined ? modelScale : 1.0,
      rotation: rotation !== undefined ? rotation : 0,
      lightingPreset: lightingPreset || 'default',
      shadowIntensity: shadowIntensity !== undefined ? shadowIntensity : 0.5,
      boundingBox: boundingBox || { width: 0, height: 0, depth: 0 },
      polygonCount: polygonCount || 0,
      textureResolution: textureResolution || '',
      compressed: compressed || false,
      previewGenerated: previewGenerated || false
    });

    await menuItem.save();

    res.status(201).json({
      success: true,
      item: menuItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a menu item
// @route   PUT /api/menu-items/:id
// @access  Private
export const updateMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const itemId = req.params.id;

    // Verify item belongs to this restaurant
    const menuItem = await MenuItem.findOne({
      _id: itemId,
      restaurantId: req.user.restaurantId
    });

    if (!menuItem) {
      res.status(404).json({ success: false, error: 'Menu item not found' });
      return;
    }

    const {
      categoryId,
      name,
      description,
      price,
      discountPrice,
      imageUrl,
      isVeg,
      isAvailable,
      preparationTime,
      spiceLevel,
      isPopular,
      isFeatured,
      modelUrl,
      previewImage,
      thumbnail,
      modelScale,
      rotation,
      lightingPreset,
      shadowIntensity,
      boundingBox,
      polygonCount,
      textureResolution,
      compressed,
      previewGenerated
    } = req.body;

    if (categoryId) {
      // Verify category belongs to this restaurant
      const categoryExists = await Category.findOne({
        _id: categoryId,
        restaurantId: req.user.restaurantId
      });
      if (!categoryExists) {
        res.status(400).json({ success: false, error: 'Invalid category for this restaurant' });
        return;
      }
      menuItem.categoryId = categoryId;
    }

    if (name) menuItem.name = name;
    if (description !== undefined) menuItem.description = description;
    if (price !== undefined) menuItem.price = price;
    if (discountPrice !== undefined) menuItem.discountPrice = discountPrice;
    if (imageUrl !== undefined) menuItem.imageUrl = imageUrl;
    if (isVeg !== undefined) menuItem.isVeg = isVeg;
    if (isAvailable !== undefined) menuItem.isAvailable = isAvailable;
    if (preparationTime !== undefined) menuItem.preparationTime = preparationTime;
    if (spiceLevel !== undefined) menuItem.spiceLevel = spiceLevel;
    if (isPopular !== undefined) menuItem.isPopular = isPopular;
    if (isFeatured !== undefined) menuItem.isFeatured = isFeatured;
    if (modelUrl !== undefined) menuItem.modelUrl = modelUrl;
    if (previewImage !== undefined) menuItem.previewImage = previewImage;
    if (thumbnail !== undefined) menuItem.thumbnail = thumbnail;
    if (modelScale !== undefined) menuItem.modelScale = modelScale;
    if (rotation !== undefined) menuItem.rotation = rotation;
    if (lightingPreset !== undefined) menuItem.lightingPreset = lightingPreset;
    if (shadowIntensity !== undefined) menuItem.shadowIntensity = shadowIntensity;
    if (boundingBox !== undefined) menuItem.boundingBox = boundingBox;
    if (polygonCount !== undefined) menuItem.polygonCount = polygonCount;
    if (textureResolution !== undefined) menuItem.textureResolution = textureResolution;
    if (compressed !== undefined) menuItem.compressed = compressed;
    if (previewGenerated !== undefined) menuItem.previewGenerated = previewGenerated;

    await menuItem.save();

    res.status(200).json({
      success: true,
      item: menuItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu-items/:id
// @access  Private
export const deleteMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.restaurantId) {
      res.status(400).json({ success: false, error: 'Restaurant profile not linked' });
      return;
    }

    const itemId = req.params.id;

    // Verify item belongs to this restaurant
    const menuItem = await MenuItem.findOne({
      _id: itemId,
      restaurantId: req.user.restaurantId
    });

    if (!menuItem) {
      res.status(404).json({ success: false, error: 'Menu item not found' });
      return;
    }

    await MenuItem.findByIdAndDelete(itemId);

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
