import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';

export interface MatakuliahInput {
  kodeMk: string;
  namaMk: string;
  sks: number;
  semester: string;
  deskripsi?: string | null;
  kodePrasyarat?: string | null;
}

const select = {
  kodeMK: true,
  namaMk: true,
  sks: true,
  semester: true,
  deskripsi: true,
  kodePrasyarat: true,
  prasyaratFor: { select: { kodeMK: true, namaMk: true } },
  _count: { select: { jadwalKuliah: true, nilai: true } },
} satisfies Prisma.MatakuliahSelect;

type Row = Prisma.MatakuliahGetPayload<{ select: typeof select }>;

/** API memakai `kodeMk` secara konsisten (kolom Prisma bernama `kodeMK`). */
const toDto = ({ kodeMK, prasyaratFor, _count, ...rest }: Row) => ({
  kodeMk: kodeMK,
  ...rest,
  prasyarat: prasyaratFor ? { kodeMk: prasyaratFor.kodeMK, namaMk: prasyaratFor.namaMk } : null,
  jumlahJadwal: _count.jadwalKuliah,
});

export class MatakuliahService {
  async list(search?: string): Promise<ApiResponse> {
    const where: Prisma.MatakuliahWhereInput = search
      ? {
          OR: [
            { kodeMK: { contains: search, mode: 'insensitive' } },
            { namaMk: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const rows = await prisma.matakuliah.findMany({ where, select, orderBy: [{ semester: 'asc' }, { kodeMK: 'asc' }] });
    return ok(rows.map(toDto));
  }

  async get(kodeMk: string): Promise<ApiResponse> {
    const row = await prisma.matakuliah.findUnique({ where: { kodeMK: kodeMk }, select });
    return row ? ok(toDto(row)) : fail('NOT_FOUND', 'Mata kuliah tidak ditemukan');
  }

  async create(input: MatakuliahInput): Promise<ApiResponse> {
    const kodeMk = input.kodeMk.toUpperCase();
    if (await prisma.matakuliah.findUnique({ where: { kodeMK: kodeMk }, select: { kodeMK: true } })) {
      return fail('KODE_MK_EXISTS', 'Kode mata kuliah sudah dipakai');
    }
    const invalid = await this.checkPrasyarat(kodeMk, input.kodePrasyarat);
    if (invalid) return invalid;

    const row = await prisma.matakuliah.create({
      data: {
        kodeMK: kodeMk,
        namaMk: input.namaMk,
        sks: input.sks,
        semester: input.semester,
        deskripsi: input.deskripsi || null,
        kodePrasyarat: input.kodePrasyarat?.toUpperCase() || null,
      },
      select,
    });
    return ok(toDto(row), 'Mata kuliah ditambahkan');
  }

  async update(kodeMk: string, input: Partial<Omit<MatakuliahInput, 'kodeMk'>>): Promise<ApiResponse> {
    if (!(await prisma.matakuliah.findUnique({ where: { kodeMK: kodeMk }, select: { kodeMK: true } }))) {
      return fail('NOT_FOUND', 'Mata kuliah tidak ditemukan');
    }
    if (input.kodePrasyarat !== undefined) {
      const invalid = await this.checkPrasyarat(kodeMk, input.kodePrasyarat);
      if (invalid) return invalid;
    }
    const row = await prisma.matakuliah.update({
      where: { kodeMK: kodeMk },
      data: {
        namaMk: input.namaMk,
        sks: input.sks,
        semester: input.semester,
        deskripsi: input.deskripsi === undefined ? undefined : input.deskripsi || null,
        kodePrasyarat: input.kodePrasyarat === undefined ? undefined : input.kodePrasyarat?.toUpperCase() || null,
      },
      select,
    });
    return ok(toDto(row), 'Mata kuliah diperbarui');
  }

  async remove(kodeMk: string): Promise<ApiResponse> {
    const row = await prisma.matakuliah.findUnique({ where: { kodeMK: kodeMk }, select });
    if (!row) return fail('NOT_FOUND', 'Mata kuliah tidak ditemukan');
    // Cascade akan menghapus jadwal, KRS, dan nilai — tolak bila datanya sudah dipakai.
    if (row._count.jadwalKuliah > 0 || row._count.nilai > 0) {
      return fail('IN_USE', 'Mata kuliah sudah memiliki jadwal atau nilai sehingga tidak dapat dihapus');
    }
    await prisma.$transaction([
      prisma.matakuliah.updateMany({ where: { kodePrasyarat: kodeMk }, data: { kodePrasyarat: null } }),
      prisma.matakuliah.delete({ where: { kodeMK: kodeMk } }),
    ]);
    return ok(null, 'Mata kuliah dihapus');
  }

  /** Prasyarat harus ada, bukan dirinya sendiri, dan tidak membentuk siklus. */
  private async checkPrasyarat(kodeMk: string, kodePrasyarat?: string | null): Promise<ApiResponse | null> {
    if (!kodePrasyarat) return null;
    let current: string | null = kodePrasyarat.toUpperCase();
    const seen = new Set<string>();
    while (current) {
      if (current === kodeMk) return fail('PRASYARAT_INVALID', 'Prasyarat membentuk ketergantungan melingkar');
      if (seen.has(current)) break;
      seen.add(current);
      const mk: { kodePrasyarat: string | null } | null = await prisma.matakuliah.findUnique({
        where: { kodeMK: current },
        select: { kodePrasyarat: true },
      });
      if (!mk) return fail('PRASYARAT_NOT_FOUND', `Mata kuliah prasyarat ${current} tidak ditemukan`);
      current = mk.kodePrasyarat;
    }
    return null;
  }
}
