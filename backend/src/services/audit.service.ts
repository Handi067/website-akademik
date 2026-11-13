import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { ok, pagination, paging } from '@/utils/http';

export class AuditService {
  async list(query: Parameters<typeof paging>[0]): Promise<ApiResponse> {
    const { page, limit, skip } = paging(query);
    const where = {
      tabel: (query.tabel as string) || undefined,
      user: query.username ? { username: { contains: String(query.username), mode: 'insensitive' as const } } : undefined,
    };
    const [rows, total, tabel] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          aksi: true,
          tabel: true,
          recordId: true,
          dataBaru: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { username: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ distinct: ['tabel'], select: { tabel: true }, orderBy: { tabel: 'asc' } }),
    ]);
    return ok({
      items: rows.map(({ user, ...r }) => ({ ...r, username: user?.username ?? null, role: user?.role ?? null })),
      tabel: tabel.map((t) => t.tabel),
      pagination: pagination(page, limit, total),
    });
  }
}
