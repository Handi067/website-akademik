import { Request } from 'express';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail } from '@/utils/http';

/**
 * Menentukan NIM yang boleh diakses oleh pengguna:
 * - MAHASISWA → NIM miliknya sendiri (parameter `nim` diabaikan),
 * - ADMIN     → NIM dari query `?nim=`,
 * - lainnya   → ditolak.
 */
export const targetNim = async (req: Request): Promise<{ nim: string } | ApiResponse> => {
  const user = req.user!;
  if (user.role === 'MAHASISWA') {
    const mhs = await prisma.mahasiswa.findUnique({ where: { userId: user.id }, select: { nim: true } });
    return mhs ? { nim: mhs.nim } : fail('FORBIDDEN', 'Akun ini belum terhubung ke data mahasiswa');
  }
  if (user.role === 'ADMIN') {
    const nim = typeof req.query.nim === 'string' ? req.query.nim : '';
    return nim ? { nim } : fail('VALIDATION_ERROR', 'Parameter nim wajib diisi');
  }
  return fail('FORBIDDEN', 'Akses ditolak');
};

export const nidnOf = async (userId: string): Promise<string | null> =>
  (await prisma.dosen.findUnique({ where: { userId }, select: { nidn: true } }))?.nidn ?? null;

export const isError = (v: object): v is ApiResponse => 'success' in v;
