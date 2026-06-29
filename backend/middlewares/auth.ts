import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { verifyToken } from '../utils/jwt';

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'superadmin' | 'owner' | 'manager' | 'staff';
        restaurantId?: string;
      };
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = '';

    // Check Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Check cookies manually
    else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie) => {
        const [key, val] = cookie.trim().split('=');
        acc[key] = val;
        return acc;
      }, {});
      token = cookies.token || '';
    }

    if (!token) {
      res.status(401).json({ success: false, error: 'Not authorized, token missing' });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);

    // Fetch user from DB
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      res.status(401).json({ success: false, error: 'User no longer exists' });
      return;
    }

    // Attach user payload
    req.user = {
      id: user._id.toString() as string,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId ? user.restaurantId.toString() : undefined
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Not authorized, invalid token' });
  }
};

// Role authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `User role '${req.user?.role || 'guest'}' is not authorized to access this route`
      });
      return;
    }
    next();
  };
};
