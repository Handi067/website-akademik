import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { hashPassword } from '@/utils/password';
import { fail, ok, pagination } from '@/utils/http';

export interface CreateDosenInput {
  nidn: string;
  namaDosen: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  email: string;
  noHp?: string;
  departemen?: string;
  username: string;
  password: string;
}

export type UpdateDosenInput = Partial<Omit<CreateDosenInput, 'nidn' | 'username' | 'password'>>;

const select = {
  nidn: true,
  namaDosen: true,
  gelarDepan: true,
  gelarBelakang: true,
  email: true,
  noHp: true,
  departemen: true,
  createdAt: true,
  user: { select: { id: true, username: true, isActive: true } },
  _count: { select: { jadwalKuliah: true } },
} satisfies Prisma.DosenSelect;

export class DosenService {
  async list(opts: { search?: string; page: number; limit: number; skip: number }): Promise<ApiResponse> {
    const where: Prisma.DosenWhereInput = opts.search
      ? {
          OR: [
            { nidn: { contains: opts.search } },
            { namaDosen: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      prisma.dosen.findMany({ where, select, orderBy: { namaDosen: 'asc' }, skip: opts.skip, take: opts.limit }),
      prisma.dosen.count({ where }),
    ]);
    return { ...ok(data), pagination: pagination(opts.page, opts.limit, total) };
  }

  async get(nidn: string): Promise<ApiResponse> {
    const dosen = await prisma.dosen.findUnique({ where: { nidn }, select });
    return dosen ? ok(dosen) : fail('NOT_FOUND', 'Dosen tidak ditemukan');
  }

  async create(input: CreateDosenInput): Promise<ApiResponse> {
    const [nidnTaken, userTaken] = await Promise.all([
      prisma.dosen.findUnique({ where: { nidn: input.nidn }, select: { nidn: true } }),
      prisma.user.findFirst({
        where: { OR: [{ username: input.username }, { email: input.email }] },
        select: { id: true },
      }),
    ]);
    if (nidnTaken) return fail('NIDN_EXISTS', 'NIDN sudah terdaftar');
    if (userTaken) return fail('USER_EXISTS', 'Username atau email sudah dipakai');

    const passwordHash = await hashPassword(input.password);
    const { username, password: _password, ...profil } = input;
    const dosen = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, email: input.email, passwordHash, role: Role.DOSEN },
      });
      return tx.dosen.create({ data: { ...profil, userId: user.id }, select });
    });
    return ok(dosen, 'Dosen berhasil ditambahkan');
  }

  async update(nidn: string, input: UpdateDosenInput): Promise<ApiResponse> {
    const existing = await prisma.dosen.findUnique({ where: { nidn }, select: { userId: true } });
    if (!existing) return fail('NOT_FOUND', 'Dosen tidak ditemukan');

    if (input.email) {
      const taken = await prisma.user.findFirst({
        where: { email: input.email, id: { not: existing.userId } },
        select: { id: true },
      });
      if (taken) return fail('EMAIL_EXISTS', 'Email sudah dipakai');
    }

    const dosen = await prisma.$transaction(async (tx) => {
      if (input.email) await tx.user.update({ where: { id: existing.userId }, data: { email: input.email } });
      return tx.dosen.update({ where: { nidn }, data: input, select });
    });
    return ok(dosen, 'Data dosen diperbarui');
  }

  async remove(nidn: string): Promise<ApiResponse> {
    const dosen = await prisma.dosen.findUnique({ where: { nidn }, select });
    if (!dosen) return fail('NOT_FOUND', 'Dosen tidak ditemukan');
    // Menghapus dosen akan ikut menghapus jadwal & KRS-nya (cascade), jadi ditolak bila masih mengajar.
    if (dosen._count.jadwalKuliah > 0) {
      return fail('IN_USE', 'Dosen masih memiliki jadwal kuliah. Hapus atau pindahkan jadwalnya terlebih dahulu.');
    }
    await prisma.user.delete({ where: { id: dosen.user.id } });
    return ok(null, 'Dosen dihapus');
  }
}
