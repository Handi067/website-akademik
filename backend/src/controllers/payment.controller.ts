import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { prisma } from '../config/database';
import { isError, targetNim } from '../utils/actor';

const paymentService = new PaymentService();

export class PaymentController {
  async createToken(req: Request, res: Response) {
    try {
      const { tagihanId } = req.body;
      if (typeof tagihanId !== 'string' || !tagihanId) {
        return res.status(400).json({ success: false, message: 'tagihanId wajib diisi', error: 'VALIDATION_ERROR' });
      }

      // Mahasiswa hanya boleh membayar tagihannya sendiri
      if (req.user!.role === 'MAHASISWA') {
        const target = await targetNim(req);
        const tagihan = await prisma.tagihan.findUnique({ where: { id: tagihanId }, select: { nim: true } });
        if (isError(target) || !tagihan || tagihan.nim !== target.nim) {
          return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan', error: 'NOT_FOUND' });
        }
      }

      const data = await paymentService.createSnapToken(tagihanId);
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async webhook(req: Request, res: Response) {
    try {
      const notificationData = req.body;
      await paymentService.handleWebhook(notificationData);
      return res.status(200).json({ success: true, message: 'Webhook handled' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
