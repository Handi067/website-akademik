import { Request, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

export const ok = <T>(data: T, message = 'OK'): ApiResponse<T> => ({ success: true, message, data });

export const fail = (error: string, message: string, data?: unknown): ApiResponse<any> => ({
  success: false,
  error,
  message,
  ...(data === undefined ? {} : { data }),
});

/** Maps a service error code to an HTTP status. */
const statusFor = (error = ''): number => {
  if (error === 'FORBIDDEN') return 403;
  if (error.endsWith('NOT_FOUND')) return 404;
  if (error.endsWith('_EXISTS') || error.endsWith('CONFLICT') || error === 'IN_USE' || error === 'RETRY') return 409;
  return 400;
};

/**
 * Wraps a service call that returns an ApiResponse into an Express handler.
 * Success → `successStatus`, failure → status derived from the error code,
 * unexpected exception → 500 (details only in the server log).
 */
export const handle =
  (fn: (req: Request) => Promise<ApiResponse<any>>, successStatus = 200): RequestHandler =>
  async (req, res) => {
    try {
      const result = await fn(req);
      res.status(result.success ? successStatus : statusFor(result.error)).json(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          res.status(409).json(fail('ALREADY_EXISTS', 'Data dengan kunci yang sama sudah ada'));
          return;
        }
        if (error.code === 'P2034') {
          res.status(409).json(fail('RETRY', 'Terjadi bentrokan transaksi, silakan coba lagi'));
          return;
        }
      }
      logger.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
      res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
    }
  };

export const paging = (query: Request['query']) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

export const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
