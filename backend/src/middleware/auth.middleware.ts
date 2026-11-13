import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/utils/jwt';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        message: 'Access token required',
        error: 'NO_TOKEN'
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = verifyAccessToken(token);
      
      // Verify user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true
        }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
        res.status(401).json(response);
        return;
      }

      if (!user.isActive) {
        const response: ApiResponse = {
          success: false,
          message: 'User account is deactivated',
          error: 'USER_DEACTIVATED'
        };
        res.status(401).json(response);
        return;
      }

      req.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      next();
    } catch (tokenError) {
      const response: ApiResponse = {
        success: false,
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      };
      res.status(401).json(response);
      return;
    }
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentication failed',
      error: 'AUTH_ERROR'
    };
    res.status(500).json(response);
    return;
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = verifyAccessToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true
        }
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role
        };
      }
    } catch (tokenError) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next();
  }
};

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: 'AUTH_REQUIRED'
      };
      res.status(401).json(response);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const response: ApiResponse = {
        success: false,
        message: 'You do not have permission to access this resource',
        error: 'FORBIDDEN'
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

export const adminOnly = authorizeRole(['ADMIN']);
