import { Router, Request, Response } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate, authorizeRole } from '@/middleware/auth.middleware';

const router = Router();
const paymentController = new PaymentController();

// Request Token directly from snap API (mahasiswa pemilik tagihan / admin)
router.post(
  '/token',
  authenticate,
  authorizeRole(['MAHASISWA', 'ADMIN']),
  (req: Request, res: Response) => paymentController.createToken(req, res)
);

// Webhook notification handler
router.post('/webhook', (req: Request, res: Response) => paymentController.webhook(req, res));

export default router;
