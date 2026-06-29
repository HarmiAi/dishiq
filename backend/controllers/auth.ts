import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Restaurant from '../models/Restaurant';
import { generateToken } from '../utils/jwt';
import { generateUniqueSlug } from '../utils/slugify';

// @desc    Register a new restaurant & owner
// @route   POST /api/auth/register
// @access  Public
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let createdUser: any = null;
  let createdRestaurant: any = null;

  try {
    const { email, password, restaurantName } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ success: false, error: 'User already exists with this email' });
      return;
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(restaurantName, Restaurant);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    createdUser = new User({
      email,
      passwordHash,
      role: 'owner'
    });
    await createdUser.save();

    // Create restaurant
    createdRestaurant = new Restaurant({
      ownerId: createdUser._id,
      name: restaurantName,
      slug
    });
    await createdRestaurant.save();

    // Link restaurant to user
    createdUser.restaurantId = createdRestaurant._id;
    await createdUser.save();

    // Generate JWT
    const token = generateToken({
      userId: createdUser._id.toString(),
      role: createdUser.role,
      restaurantId: createdRestaurant._id.toString()
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: createdUser._id.toString(),
        email: createdUser.email,
        role: createdUser.role,
        restaurantId: createdRestaurant._id.toString()
      },
      restaurant: {
        id: createdRestaurant._id.toString(),
        name: createdRestaurant.name,
        slug: createdRestaurant.slug
      }
    });
  } catch (error) {
    // Manual rollback in case of error
    if (createdRestaurant && createdRestaurant._id) {
      await Restaurant.findByIdAndDelete(createdRestaurant._id);
    }
    if (createdUser && createdUser._id) {
      await User.findByIdAndDelete(createdUser._id);
    }
    next(error);
  }
};

// @desc    Login restaurant owner / staff
// @route   POST /api/auth/login
// @access  Public
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).populate('restaurantId');
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const restaurantId = user.restaurantId ? (user.restaurantId as any)._id.toString() : undefined;

    // Generate JWT
    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
      restaurantId
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        restaurantId
      },
      restaurant: user.restaurantId
        ? {
            id: restaurantId,
            name: (user.restaurantId as any).name,
            slug: (user.restaurantId as any).slug
          }
        : null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0)
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user details
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const restaurant = user.restaurantId
      ? await Restaurant.findById(user.restaurantId)
      : null;

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId ? user.restaurantId.toString() : undefined
      },
      restaurant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mock Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ success: false, error: 'Please provide email' });
      return;
    }

    const exists = await User.exists({ email });
    if (!exists) {
      // Return 200 for security reasons to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If that email exists in our system, a reset link has been generated.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'If that email exists in our system, a reset link has been generated. (Mock reset: Token generation active).'
    });
  } catch (error) {
    next(error);
  }
};
