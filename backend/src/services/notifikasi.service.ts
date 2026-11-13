import { NotifikasiTipe, Role } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok, pagination, paging } from '@/utils/http';
import { logger } from '@/utils/logger';

interface Pesan {
  judul: string;
  pesan: string;
  tipe?: NotifikasiTipe;
}

/**
 * Pengiriman notifikasi bersifat "best effort": kegagalan hanya dicatat di log
 * dan tidak membatalkan aksi utama yang memicunya.
 */
export const notify = {
  async users(userIds: string[], p: Pesan) {
    if (!userIds.length) return;
    try {
      await prisma.notifikasi.createMany({
        data: userIds.map((userId) => ({ userId, judul: p.judul, pesan: p.pesan, tipe: p.tipe ?? NotifikasiTipe.INFO })),
      });
    } catch (error) {
      logger.error('Gagal membuat notifikasi:', error);
    }
  },

  async mahasiswa(nims: string[], p: Pesan) {
    try {
      const rows = await prisma.mahasiswa.findMany({ where: { nim: { in: nims } }, select: { userId: true } });
      await notify.users(rows.map((r) => r.userId), p);
    } catch (error) {
      logger.error('Gagal membuat notifikasi:', error);
    }
  },

  async admins(p: Pesan) {
    try {
      const rows = await prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { id: true } });
      await notify.users(rows.map((r) => r.id), p);
    } catch (error) {
      logger.error('Gagal membuat notifikasi:', error);
    }
  },
};

export class NotifikasiService {
  async list(userId: string, query: Parameters<typeof paging>[0]): Promise<ApiResponse> {
    const { page, limit, skip } = paging(query);
    const where = { userId, isRead: query.unread === 'true' ? false : undefined };
    const [items, total, unread] = await Promise.all([
      prisma.notifikasi.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, judul: true, pesan: true, tipe: true, isRead: true, createdAt: true },
      }),
      prisma.notifikasi.count({ where }),
      prisma.notifikasi.count({ where: { userId, isRead: false } }),
    ]);
    return ok({ items, unread, pagination: pagination(page, limit, total) });
  }

  async markRead(userId: string, id: string): Promise<ApiResponse> {
    const n = await prisma.notifikasi.findFirst({ where: { id, userId }, select: { isRead: true } });
    if (!n) return fail('NOT_FOUND', 'Notifikasi tidak ditemukan');
    if (!n.isRead) await prisma.notifikasi.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
    return ok(null, 'Notifikasi ditandai sudah dibaca');
  }

  async markAllRead(userId: string): Promise<ApiResponse> {
    const { count } = await prisma.notifikasi.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return ok({ count }, `${count} notifikasi ditandai sudah dibaca`);
  }
}
