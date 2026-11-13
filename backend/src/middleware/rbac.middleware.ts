import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types/academic.types';

type Role = 'ADMIN' | 'DOSEN' | 'MAHASISWA';

export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED'
      };
      res.status(401).json(response);
      return;
    }

    const userRole = req.user.role as Role;
    
    if (!allowedRoles.includes(userRole)) {
      const response: ApiResponse = {
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS'
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

export const adminOnly = authorize(['ADMIN']);
export const dosenOnly = authorize(['DOSEN', 'ADMIN']);
export const mahasiswaOnly = authorize(['MAHASISWA', 'ADMIN']);
export const dosenOrMahasiswa = authorize(['DOSEN', 'MAHASISWA', 'ADMIN']);

export const resourceOwnerOrAdmin = (getResourceOwnerId: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED'
      };
      res.status(401).json(response);
      return;
    }

    const userRole = req.user.role as Role;
    const resourceOwnerId = getResourceOwnerId(req);
    const currentUserId = req.user.id;

    // Admin can access any resource
    if (userRole === 'ADMIN') {
      next();
      return;
    }

    // Check if user is the owner of the resource
    if (currentUserId === resourceOwnerId) {
      next();
      return;
    }

    const response: ApiResponse = {
      success: false,
      message: 'Access denied: You can only access your own resources',
      error: 'RESOURCE_ACCESS_DENIED'
    };
    res.status(403).json(response);
    return;
  };
};
