import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiResponse } from '@/types/academic.types';

/**
 * Express middleware that rejects the request with 400 when any preceding
 * express-validator chain in the same route reported an error.
 *
 * Usage: router.post('/', [body('x').notEmpty()], validateRequest, handler)
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      data: { errors: errors.array().map((error) => error.msg) }
    };
    res.status(400).json(response);
    return;
  }

  next();
};
