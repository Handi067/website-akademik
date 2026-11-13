import { Hari, KrsStatus, Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';
import { formatTime, HARI_URUT, parseTime } from '@/utils/time';

export interface JadwalInput {
  kodeMk: string;
  nidn: string;
  hari: Hari;
  jamMulai: string; // HH:MM
  jamSelesai: string; // HH:MM
  ruangan: string;
  kelas?: string | null;
  semester: string;
  tahunAjaran: string;
  kapasitas: number;
}

export interface JadwalFilter {
  semester?: string;
  tahunAjaran?: string;
  nidn?: string;
  kodeMk?: string;
  hari?: Hari;
}

export const jadwalSelect = {
  id: true,
  hari: true,
  jamMulai: true,
  jamSelesai: true,
  ruangan: true,
  kelas: true,
  semester: true,
  tahunAjaran: true,
  kapasitas: true,
  matakuliah: { select: { kodeMK: true, namaMk: true, sks: true } },
  dosen: { select: { nidn: true, namaDosen: true } },
  _count: { select: { krs: { where: { status: KrsStatus.AKTIF } } } },
} satisfies Prisma.JadwalKuliahSelect;

export type JadwalRow = Prisma.JadwalKuliahGetPayload<{ select: typeof jadwalSelect }>;

export const toJadwalDto = (j: JadwalRow) => ({
  id: j.id,
  kodeMk: j.matakuliah.kodeMK,
  namaMk: j.matakuliah.namaMk,
  sks: j.matakuliah.sks,
  nidn: j.dosen.nidn,
  namaDosen: j.dosen.namaDosen,
  hari: j.hari,
  jamMulai: formatTime(j.jamMulai),
  jamSelesai: formatTime(j.jamSelesai),
  ruangan: j.ruangan,
  kelas: j.kelas,
  semester: j.semester,
  tahunAjaran: j.tahunAjaran,
  kapasitas: j.kapasitas,
  terisi: j._count.krs,
});

export const sortJadwal = <T extends { hari: Hari; jamMulai: string }>(rows: T[]): T[] =>
  [...rows].sort(
    (a, b) => HARI_URUT.indexOf(a.hari) - HARI_URUT.indexOf(b.hari) || a.jamMulai.localeCompare(b.jamMulai)
  );

export class JadwalService {
  async list(filter: JadwalFilter): Promise<ApiResponse> {
    const rows = await prisma.jadwalKuliah.findMany({
      where: {
        semester: filter.semester,
        tahunAjaran: filter.tahunAjaran,
        nidn: filter.nidn,
        kodeMk: filter.kodeMk,
        hari: filter.hari,
      },
      select: jadwalSelect,
    });
    return ok(sortJadwal(rows.map(toJadwalDto)));
  }

  async get(id: string): Promise<ApiResponse> {
    const row = await prisma.jadwalKuliah.findUnique({ where: { id }, select: jadwalSelect });
    return row ? ok(toJadwalDto(row)) : fail('NOT_FOUND', 'Jadwal tidak ditemukan');
  }

  async create(input: JadwalInput): Promise<ApiResponse> {
    const invalid = await this.validate(input);
    if (invalid) return invalid;
    const row = await prisma.jadwalKuliah.create({ data: this.toData(input), select: jadwalSelect });
    return ok(toJadwalDto(row), 'Jadwal ditambahkan');
  }

  async update(id: string, input: JadwalInput): Promise<ApiResponse> {
    const existing = await prisma.jadwalKuliah.findUnique({ where: { id }, select: jadwalSelect });
    if (!existing) return fail('NOT_FOUND', 'Jadwal tidak ditemukan');
    if (input.kapasitas < existing._count.krs) {
      return fail('KAPASITAS_INVALID', `Kapasitas tidak boleh kurang dari jumlah peserta (${existing._count.krs})`);
    }
    if (
      existing._count.krs > 0 &&
      (input.kodeMk !== existing.matakuliah.kodeMK ||
        input.semester !== existing.semester ||
        input.tahunAjaran !== existing.tahunAjaran)
    ) {
      return fail('IN_USE', 'Mata kuliah dan periode tidak dapat diubah karena jadwal sudah memiliki peserta KRS');
    }
    const invalid = await this.validate(input, id);
    if (invalid) return invalid;
    const row = await prisma.jadwalKuliah.update({ where: { id }, data: this.toData(input), select: jadwalSelect });
    return ok(toJadwalDto(row), 'Jadwal diperbarui');
  }

  async remove(id: string): Promise<ApiResponse> {
    const row = await prisma.jadwalKuliah.findUnique({ where: { id }, select: { _count: { select: { krs: true } } } });
    if (!row) return fail('NOT_FOUND', 'Jadwal tidak ditemukan');
    if (row._count.krs > 0) return fail('IN_USE', 'Jadwal sudah diambil mahasiswa di KRS sehingga tidak dapat dihapus');
    await prisma.jadwalKuliah.delete({ where: { id } });
    return ok(null, 'Jadwal dihapus');
  }

  private toData(input: JadwalInput) {
    return {
      kodeMk: input.kodeMk,
      nidn: input.nidn,
      hari: input.hari,
      jamMulai: parseTime(input.jamMulai),
      jamSelesai: parseTime(input.jamSelesai),
      ruangan: input.ruangan,
      kelas: input.kelas || null,
      semester: input.semester,
      tahunAjaran: input.tahunAjaran,
      kapasitas: input.kapasitas,
    };
  }

  /** MK & dosen harus ada; ruangan dan dosen tidak boleh bentrok di periode & hari yang sama. */
  private async validate(input: JadwalInput, excludeId?: string): Promise<ApiResponse | null> {
    if (input.jamMulai >= input.jamSelesai) return fail('JAM_INVALID', 'Jam selesai harus setelah jam mulai');

    const [mk, dosen] = await Promise.all([
      prisma.matakuliah.findUnique({ where: { kodeMK: input.kodeMk }, select: { kodeMK: true } }),
      prisma.dosen.findUnique({ where: { nidn: input.nidn }, select: { nidn: true } }),
    ]);
    if (!mk) return fail('MATAKULIAH_NOT_FOUND', 'Mata kuliah tidak ditemukan');
    if (!dosen) return fail('DOSEN_NOT_FOUND', 'Dosen tidak ditemukan');

    const bentrok = await prisma.jadwalKuliah.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        semester: input.semester,
        tahunAjaran: input.tahunAjaran,
        hari: input.hari,
        jamMulai: { lt: parseTime(input.jamSelesai) },
        jamSelesai: { gt: parseTime(input.jamMulai) },
        OR: [{ ruangan: { equals: input.ruangan, mode: 'insensitive' } }, { nidn: input.nidn }],
      },
      select: jadwalSelect,
    });
    if (bentrok) {
      const b = toJadwalDto(bentrok);
      const sebab = b.nidn === input.nidn ? `dosen ${b.namaDosen}` : `ruangan ${b.ruangan}`;
      return fail(
        'JADWAL_CONFLICT',
        `Bentrok dengan ${b.kodeMk} ${b.namaMk} (${b.hari} ${b.jamMulai}–${b.jamSelesai}) pada ${sebab}`
      );
    }
    return null;
  }
}
