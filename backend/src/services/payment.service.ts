import { prisma } from '../config/database';
import { logger } from '../utils/logger';
// @ts-ignore
import midtransClient from 'midtrans-client';
import { StatusPembayaran } from '@prisma/client';

export class PaymentService {
  private snap: any;

  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DUMMY',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-DUMMY'
    });
  }

  async createSnapToken(tagihanId: string): Promise<any> {
    try {
      const tagihan = await prisma.tagihan.findUnique({
        where: { id: tagihanId },
        include: { mahasiswa: true }
      });

      if (!tagihan) {
        throw new Error('Tagihan not found');
      }

      if (tagihan.status === 'SUCCESS') {
        throw new Error('Tagihan already paid');
      }

      // Check if pending payment exists
      let pembayaran = await prisma.pembayaran.findFirst({
        where: { tagihanId, status: 'PENDING' }
      });

      const transactionId = `TRX-${tagihanId}-${Date.now()}`;

      if (!pembayaran) {
        pembayaran = await prisma.pembayaran.create({
          data: {
            tagihanId: tagihan.id,
            transactionId,
            status: 'PENDING'
          }
        });
      }

      const parameter = {
        transaction_details: {
          order_id: pembayaran.transactionId,
          gross_amount: Number(tagihan.jumlah)
        },
        credit_card: { secure: true },
        customer_details: {
          first_name: tagihan.mahasiswa.namaMhs,
          email: tagihan.mahasiswa.angkatan + '@university.edu', // Dummy email fallback
          phone: tagihan.mahasiswa.noHp || '08123456789'
        }
      };

      const snapResponse = await this.snap.createTransaction(parameter);
      
      // Update payment URL
      await prisma.pembayaran.update({
        where: { id: pembayaran.id },
        data: { paymentUrl: snapResponse.redirect_url }
      });

      return {
        token: snapResponse.token,
        redirect_url: snapResponse.redirect_url
      };
    } catch (error) {
      logger.error('Error creating snap token:', error);
      throw error;
    }
  }

  async handleWebhook(notificationData: any): Promise<void> {
    try {
      const statusResponse = await this.snap.transaction.notification(notificationData);
      
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      let paymentStatus: StatusPembayaran = 'PENDING';

      if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
        if (fraudStatus == 'challenge') {
          paymentStatus = 'PENDING';
        } else if (fraudStatus == 'accept') {
          paymentStatus = 'SUCCESS';
        } else {
            paymentStatus = 'SUCCESS'; // settlement usually no fraud check
        }
      } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
        paymentStatus = 'FAILED';
      } else if (transactionStatus == 'pending') {
        paymentStatus = 'PENDING';
      }

      const pembayaran = await prisma.pembayaran.findFirst({
        where: { transactionId: orderId }
      });

      if (pembayaran) {
        await prisma.pembayaran.update({
          where: { id: pembayaran.id },
          data: {
            status: paymentStatus,
            waktuTransaksi: statusResponse.transaction_time ? new Date(statusResponse.transaction_time) : new Date(),
            metodePembayaran: statusResponse.payment_type
          }
        });

        if (paymentStatus === 'SUCCESS') {
           await prisma.tagihan.update({
             where: { id: pembayaran.tagihanId },
             data: { status: 'SUCCESS' }
           });
        }
      }

    } catch (error) {
      logger.error('Webhook error:', error);
      throw error;
    }
  }
}
