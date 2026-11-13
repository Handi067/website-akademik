import { prisma } from '../config/database';
import { JenisTagihan } from '@prisma/client';

export class TagihanService {
  async getTagihanMahasiswa(nim: string) {
    return prisma.tagihan.findMany({
      where: { nim },
      include: { pembayaran: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllTagihan() {
    return prisma.tagihan.findMany({
      include: {
        mahasiswa: { select: { namaMhs: true, jurusan: true } },
        pembayaran: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTagihanBase(nim: string, jenis: JenisTagihan, jumlah: number, tenggatWaktu: Date, keterangan?: string) {
    return prisma.tagihan.create({
      data: {
        nim,
        jenisTagihan: jenis,
        jumlah,
        tenggatWaktu,
        keterangan
      }
    });
  }
}
