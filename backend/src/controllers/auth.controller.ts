import { Request, Response } from 'express';
import { AuthService } from '@/services/auth.service';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Register controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(401).json(result);
      }
    } catch (error) {
      logger.error('Login controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          message: 'Refresh token required',
          error: 'REFRESH_TOKEN_REQUIRED'
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.authService.refreshToken(refreshToken);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(401).json(result);
      }
    } catch (error) {
      logger.error('Refresh token controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED'
        };
        res.status(401).json(response);
        return;
      }

      const result = await this.authService.changePassword(req.user.id, req.body);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Change password controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED'
        };
        res.status(401).json(response);
        return;
      }

      const result = await this.authService.getProfile(req.user.id);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      logger.error('Get profile controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED'
        };
        res.status(401).json(response);
        return;
      }

      const result = await this.authService.updateProfile(req.user.id, req.body);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Update profile controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // In a real implementation, you might want to blacklist the token
      // For now, we'll just return a success response
      const response: ApiResponse = {
        success: true,
        message: 'Logout successful'
      };
      res.status(200).json(response);
    } catch (error) {
      logger.error('Logout controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };
}
