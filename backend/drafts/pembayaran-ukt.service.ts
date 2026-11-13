import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

interface UKTTarif {
  angkatan: string;
  jurusan: string;
  golongan: string;
  jumlah: number;
  tahunAkademik: string;
  semester: string;
}

interface PembayaranUKTRequest {
  nim: string;
  tahunAkademik: string;
  semester: string;
  metodePembayaran: string;
  buktiPembayaran?: string;
  catatan?: string;
}

export class PembayaranUKTService {
  private tarifUKT: UKTTarif[] = [
    // S1 Teknik Informatika
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 8500000, tahunAkademik: '2021/2022', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 8500000, tahunAkademik: '2021/2022', semester: 'Genap' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 9000000, tahunAkademik: '2022/2023', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 9000000, tahunAkademik: '2022/2023', semester: 'Genap' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 9500000, tahunAkademik: '2023/2024', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 9500000, tahunAkademik: '2023/2024', semester: 'Genap' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 10000000, tahunAkademik: '2024/2025', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'S1', jumlah: 10000000, tahunAkademik: '2024/2025', semester: 'Genap' },
    
    // D3 Teknik Informatika
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 6500000, tahunAkademik: '2021/2022', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 6500000, tahunAkademik: '2021/2022', semester: 'Genap' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 7000000, tahunAkademik: '2022/2023', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 7000000, tahunAkademik: '2022/2023', semester: 'Genap' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 7500000, tahunAkademik: '2023/2024', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 7500000, tahunAkademik: '2023/2024', semester: 'Genap' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 8000000, tahunAkademik: '2024/2025', semester: 'Ganjil' },
    { angkatan: '2021', jurusan: 'Teknik Informatika', golongan: 'D3', jumlah: 8000000, tahunAkademik: '2024/2025', semester: 'Genap' },
  ];

  async createPembayaranUKT(data: PembayaranUKTRequest): Promise<ApiResponse> {
    try {
      // Check if student exists
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim: data.nim }
      });

      if (!mahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'MAHASISWA_NOT_FOUND'
        };
      }

      // Check if payment already exists
      const existingPayment = await prisma.pembayaranUKT.findFirst({
        where: {
          nim: data.nim,
          tahunAkademik: data.tahunAkademik,
          semester: data.semester
        }
      });

      if (existingPayment) {
        return {
          success: false,
          message: 'Payment for this semester already exists',
          error: 'PAYMENT_EXISTS'
        };
      }

      // Get UKT amount based on student data
      const tarif = this.getUKTTarif(mahasiswa.angkatan, mahasiswa.jurusan, data.tahunAkademik, data.semester);
      
      if (!tarif) {
        return {
          success: false,
          message: 'UKT tariff not found for this student',
          error: 'TARIF_NOT_FOUND'
        };
      }

      // Create payment record
      const pembayaran = await prisma.pembayaranUKT.create({
        data: {
          nim: data.nim,
          tahunAkademik: data.tahunAkademik,
          semester: data.semester,
          jumlah: tarif.jumlah,
          status: 'MENUNGGU_VERIFIKASI',
          metodePembayaran: data.metodePembayaran,
          noReferensi: this.generateReferenceNumber(),
          buktiPembayaran: data.buktiPembayaran,
          catatan: data.catatan
        }
      });

      logger.info(`UKT payment created: ${data.nim} - ${data.tahunAkademik}/${data.semester}`);

      return {
        success: true,
        message: 'UKT payment created successfully',
        data: pembayaran
      };
    } catch (error) {
      logger.error('Error creating UKT payment:', error);
      return {
        success: false,
        message: 'Failed to create UKT payment',
        error: 'CREATE_ERROR'
      };
    }
  }

  async verifyPembayaranUKT(pembayaranId: string, verifiedBy: string): Promise<ApiResponse> {
    try {
      const pembayaran = await prisma.pembayaranUKT.findUnique({
        where: { id: pembayaranId },
        include: {
          mahasiswa: {
            select: {
              nim: true,
              namaMhs: true,
              jurusan: true
            }
          }
        }
      });

      if (!pembayaran) {
        return {
          success: false,
          message: 'Payment not found',
          error: 'PAYMENT_NOT_FOUND'
        };
      }

      if (pembayaran.status === 'SUDAH_BAYAR') {
        return {
          success: false,
          message: 'Payment already verified',
          error: 'ALREADY_VERIFIED'
        };
      }

      if (pembayaran.status !== 'MENUNGGU_VERIFIKASI') {
        return {
          success: false,
          message: 'Payment cannot be verified in current status',
          error: 'INVALID_STATUS'
        };
      }

      // Update payment status
      const updatedPembayaran = await prisma.pembayaranUKT.update({
        where: { id: pembayaranId },
        data: {
          status: 'SUDAH_BAYAR',
          verifiedBy,
          verifiedAt: new Date(),
          tanggalBayar: new Date()
        }
      });

      // Send notification to student
      await this.sendPaymentNotification(pembayaran.mahasiswa, pembayaran);

      logger.info(`UKT payment verified: ${pembayaranId}`);

      return {
        success: true,
        message: 'UKT payment verified successfully',
        data: updatedPembayaran
      };
    } catch (error) {
      logger.error('Error verifying UKT payment:', error);
      return {
        success: false,
        message: 'Failed to verify UKT payment',
        error: 'VERIFY_ERROR'
      };
    }
  }

  async getPembayaranList(
    pagination: any = {},
    filters: any = {}
  ): Promise<ApiResponse> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const { nim, tahunAkademik, semester, status } = filters;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (nim) where.nim = nim;
      if (tahunAkademik) where.tahunAkademik = tahunAkademik;
      if (semester) where.semester = semester;
      if (status) where.status = status;

      const [pembayaran, total] = await Promise.all([
        prisma.pembayaranUKT.findMany({
          where,
          include: {
            mahasiswa: {
              select: {
                nim: true,
                namaMhs: true,
                jurusan: true,
                angkatan: true
              }
            },
            verifiedUser: {
              select: {
                username: true,
                role: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.pembayaranUKT.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: 'Payment list retrieved successfully',
        data: {
          pembayaran,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      };
    } catch (error) {
      logger.error('Error getting payment list:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment list',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getPembayaranByNim(nim: string): Promise<ApiResponse> {
    try {
      const pembayaran = await prisma.pembayaranUKT.findMany({
        where: { nim },
        include: {
          mahasiswa: {
            select: {
              nim: true,
              namaMhs: true,
              jurusan: true,
              angkatan: true
            }
          },
          verifiedUser: {
            select: {
              username: true,
              role: true
            }
          }
        },
        orderBy: [
          { tahunAkademik: 'desc' },
          { semester: 'desc' }
        ]
      });

      return {
        success: true,
        message: 'Payment history retrieved successfully',
        data: pembayaran
      };
    } catch (error) {
      logger.error('Error getting payment history:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment history',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async checkKRSStatus(nim: string, tahunAkademik: string, semester: string): Promise<ApiResponse> {
    try {
      // Check if UKT is paid
      const pembayaran = await prisma.pembayaranUKT.findFirst({
        where: {
          nim,
          tahunAkademik,
          semester,
          status: 'SUDAH_BAYAR'
        }
      });

      const isPaid = !!pembayaran;
      const canRegisterKRS = isPaid;

      return {
        success: true,
        message: 'KRS eligibility checked successfully',
        data: {
          isPaid,
          canRegisterKRS,
          paymentInfo: pembayaran ? {
            jumlah: pembayaran.jumlah,
            tanggalBayar: pembayaran.tanggalBayar,
            metodePembayaran: pembayaran.metodePembayaran,
            noReferensi: pembayaran.noReferensi
          } : null
        }
      };
    } catch (error) {
      logger.error('Error checking KRS status:', error);
      return {
        success: false,
        message: 'Failed to check KRS eligibility',
        error: 'CHECK_ERROR'
      };
    }
  }

  async getPaymentStats(tahunAkademik: string, semester: string): Promise<ApiResponse> {
    try {
      const pembayaran = await prisma.pembayaranUKT.findMany({
        where: {
          tahunAkademik,
          semester
        },
        include: {
          mahasiswa: {
            select: {
              jurusan: true,
              angkatan: true
            }
          }
        }
      });

      const total = pembayaran.length;
      const paid = pembayaran.filter(p => p.status === 'SUDAH_BAYAR').length;
      const pending = pembayaran.filter(p => p.status === 'MENUNGGU_VERIFIKASI').length;
      const totalAmount = pembayaran.reduce((sum, p) => sum + Number(p.jumlah), 0);

      // Group by jurusan
      const jurusanStats = pembayaran.reduce((acc, p) => {
        const jurusan = p.mahasiswa.jurusan;
        if (!acc[jurusan]) {
          acc[jurusan] = { count: 0, amount: 0 };
        }
        acc[jurusan].count++;
        acc[jurusan].amount += Number(p.jumlah);
        return acc;
      }, {} as any);

      // Group by angkatan
      const angkatanStats = pembayaran.reduce((acc, p) => {
        const angkatan = p.mahasiswa.angkatan;
        if (!acc[angkatan]) {
          acc[angkatan] = { count: 0, amount: 0 };
        }
        acc[angkatan].count++;
        acc[angkatan].amount += Number(p.jumlah);
        return acc;
      }, {} as any);

      return {
        success: true,
        message: 'Payment statistics retrieved successfully',
        data: {
          total,
          paid,
          pending,
          totalAmount,
          percentage: total > 0 ? (paid / total) * 100 : 0,
          byJurusan: Object.entries(jurusanStats).map(([jurusan, data]: [string, any]) => ({
            jurusan,
            count: data.count,
            amount: data.amount,
            percentage: ((data.count / total) * 100).toFixed(1)
          })),
          byAngkatan: Object.entries(angkatanStats).map(([angkatan, data]: [string, any]) => ({
            angkatan,
            count: data.count,
            amount: data.amount,
            percentage: ((data.count / total) * 100).toFixed(1)
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment statistics',
        error: 'STATS_ERROR'
      };
    }
  }

  private getUKTTarif(angkatan: string, jurusan: string, tahunAkademik: string, semester: string): UKTTarif | null {
    return this.tarifUKT.find(tarif => 
      tarif.angkatan === angkatan && 
      tarif.jurusan === jurusan && 
      tarif.tahunAkademik === tahunAkademik && 
      tarif.semester === semester
    ) || null;
  }

  private generateReferenceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `UKT-${timestamp}-${random}`;
  }

  private async sendPaymentNotification(mahasiswa: any, pembayaran: any): Promise<void> {
    try {
      await prisma.notifikasi.create({
        data: {
          userId: mahasiswa.userId,
          judul: 'Pembayaran UKT Terverifikasi',
          pesan: `Pembayaran UKT Anda untuk semester ${pembayaran.semester} ${pembayaran.tahunAkademik} sebesar Rp ${Number(pembayaran.jumlah).toLocaleString('id-ID')} telah terverifikasi.`,
          tipe: 'SUCCESS',
          priority: 'HIGH',
          data: {
            paymentId: pembayaran.id,
            jumlah: pembayaran.jumlah,
            semester: pembayaran.semester,
            tahunAkademik: pembayaran.tahunAkademik
          }
        }
      });
    } catch (error) {
      logger.error('Error sending payment notification:', error);
    }
  }

  async updatePaymentStatus(pembayaranId: string, status: string): Promise<ApiResponse> {
    try {
      const pembayaran = await prisma.pembayaranUKT.findUnique({
        where: { id: pembayaranId }
      });

      if (!pembayaran) {
        return {
          success: false,
          message: 'Payment not found',
          error: 'NOT_FOUND'
        };
      }

      const updateData: any = { status };
      
      if (status === 'DIBATALKAN') {
        updateData.tanggalBayar = null;
        updateData.verifiedAt = null;
        updateData.verifiedBy = null;
      }

      await prisma.pembayaranUKT.update({
        where: { id: pembayaranId },
        data: updateData
      });

      logger.info(`Payment ${pembayaranId} status updated to: ${status}`);

      return {
        success: true,
        message: 'Payment status updated successfully'
      };
    } catch (error) {
      logger.error('Error updating payment status:', error);
      return {
        success: false,
        message: 'Failed to update payment status',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async exportPaymentReport(tahunAkademik: string, semester: string): Promise<ApiResponse> {
    try {
      const pembayaran = await prisma.pembayaranUKT.findMany({
        where: {
          tahunAkademik,
          semester
        },
        include: {
          mahasiswa: {
            select: {
              nim: true,
              namaMhs: true,
              jurusan: true,
              angkatan: true,
              user: {
                select: {
                  username: true,
                  email: true
                }
              }
            }
          },
          verifiedUser: {
            select: {
              username: true,
              role: true
            }
          }
        },
        orderBy: [
          { jurusan: 'asc' },
          { angkatan: 'asc' },
          { nim: 'asc' }
        ]
      });

      return {
        success: true,
        message: 'Payment report generated successfully',
        data: pembayaran
      };
    } catch (error) {
      logger.error('Error exporting payment report:', error);
      return {
        success: false,
        message: 'Failed to export payment report',
        error: 'EXPORT_ERROR'
      };
    }
  }
}
