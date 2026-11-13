import { KrsStatus } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';
import { GRADE_BOBOT, GRADE_LABEL, hitungIp, hitungNilaiAkhir, toGrade, toNumber } from '@/utils/grading';
import { nidnOf } from '@/utils/actor';
import { jadwalSelect, toJadwalDto } from '@/services/jadwal.service';

export interface NilaiInput {
  nim: string;
  tugas: number | null;
  uts: number | null;
  uas: number | null;
}

interface Actor {
  id: string;
  role: string;
}

const nilaiSelect = {
  kodeMk: true,
  tugas: true,
  uts: true,
  uas: true,
  nilaiAkhir: true,
  grade: true,
  semester: true,
  tahunAjaran: true,
  matakuliah: { select: { namaMk: true, sks: true } },
} as const;

export class NilaiService {
  /** Daftar peserta kelas beserta nilainya. Dosen hanya boleh membuka kelas yang diampunya. */
  async getKelas(jadwalId: string, actor: Actor): Promise<ApiResponse> {
    const access = await this.loadKelas(jadwalId, actor);
    if ('success' in access) return access;
    const { jadwal, peserta } = access;

    const nilai = await prisma.nilai.findMany({
      where: {
        nim: { in: peserta.map((p) => p.nim) },
        kodeMk: jadwal.kodeMk,
        semester: jadwal.semester,
        tahunAjaran: jadwal.tahunAjaran,
      },
      select: { nim: true, tugas: true, uts: true, uas: true, nilaiAkhir: true, grade: true },
    });
    const byNim = new Map(nilai.map((n) => [n.nim, n]));

    return ok({
      jadwal,
      peserta: peserta.map((p) => {
        const n = byNim.get(p.nim);
        return {
          nim: p.nim,
          namaMhs: p.namaMhs,
          tugas: toNumber(n?.tugas),
          uts: toNumber(n?.uts),
          uas: toNumber(n?.uas),
          nilaiAkhir: toNumber(n?.nilaiAkhir),
          grade: n?.grade ? GRADE_LABEL[n.grade] : null,
        };
      }),
    });
  }

  async simpanKelas(jadwalId: string, actor: Actor, items: NilaiInput[]): Promise<ApiResponse> {
    const access = await this.loadKelas(jadwalId, actor);
    if ('success' in access) return access;
    const { jadwal, peserta } = access;

    const pesertaNim = new Set(peserta.map((p) => p.nim));
    const bukanPeserta = items.filter((i) => !pesertaNim.has(i.nim)).map((i) => i.nim);
    if (bukanPeserta.length) {
      return fail('BUKAN_PESERTA', `NIM berikut bukan peserta kelas ini: ${bukanPeserta.join(', ')}`);
    }

    const key = { kodeMk: jadwal.kodeMk, semester: jadwal.semester, tahunAjaran: jadwal.tahunAjaran };
    await prisma.$transaction(
      items.map((i) => {
        const nilaiAkhir = hitungNilaiAkhir(i.tugas, i.uts, i.uas);
        const data = {
          tugas: i.tugas,
          uts: i.uts,
          uas: i.uas,
          nilaiAkhir,
          grade: nilaiAkhir === null ? null : toGrade(nilaiAkhir),
        };
        return prisma.nilai.upsert({
          where: { nim_kodeMk_semester_tahunAjaran: { nim: i.nim, ...key } },
          create: { nim: i.nim, ...key, ...data },
          update: data,
        });
      })
    );
    const result = await this.getKelas(jadwalId, actor);
    return { ...result, message: `Nilai ${items.length} mahasiswa disimpan` };
  }

  /** KHS satu periode + daftar periode yang tersedia. */
  async getKhs(nim: string, periode?: { semester?: string; tahunAjaran?: string }): Promise<ApiResponse> {
    const mhs = await prisma.mahasiswa.findUnique({ where: { nim }, select: { nim: true, namaMhs: true, jurusan: true, angkatan: true } });
    if (!mhs) return fail('NOT_FOUND', 'Mahasiswa tidak ditemukan');

    const periodeList = await prisma.nilai.findMany({
      where: { nim },
      distinct: ['semester', 'tahunAjaran'],
      select: { semester: true, tahunAjaran: true },
      orderBy: [{ tahunAjaran: 'desc' }, { semester: 'asc' }],
    });
    const dipilih =
      periode?.semester && periode?.tahunAjaran
        ? { semester: periode.semester, tahunAjaran: periode.tahunAjaran }
        : periodeList[0] ?? null;

    if (!dipilih) return ok({ mahasiswa: mhs, periodeList, periode: null, items: [], ips: 0, totalSks: 0 });

    const rows = await prisma.nilai.findMany({ where: { nim, ...dipilih }, select: nilaiSelect, orderBy: { kodeMk: 'asc' } });
    const items = rows.map(this.toItem);
    const { ip, totalSks } = hitungIp(rows.map((r) => ({ sks: r.matakuliah.sks, grade: r.grade })));
    return ok({ mahasiswa: mhs, periodeList, periode: dipilih, items, ips: ip, totalSks });
  }

  /** Transkrip: nilai terbaik per mata kuliah dan IPK kumulatif. */
  async getTranskrip(nim: string): Promise<ApiResponse> {
    const mhs = await prisma.mahasiswa.findUnique({ where: { nim }, select: { nim: true, namaMhs: true, jurusan: true, angkatan: true } });
    if (!mhs) return fail('NOT_FOUND', 'Mahasiswa tidak ditemukan');

    const rows = await prisma.nilai.findMany({ where: { nim, grade: { not: null } }, select: nilaiSelect });
    const best = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const prev = best.get(r.kodeMk);
      if (!prev || GRADE_BOBOT[r.grade!] > GRADE_BOBOT[prev.grade!]) best.set(r.kodeMk, r);
    }
    const terbaik = [...best.values()].sort((a, b) => a.kodeMk.localeCompare(b.kodeMk));
    const { ip, totalSks } = hitungIp(terbaik.map((r) => ({ sks: r.matakuliah.sks, grade: r.grade })));
    return ok({ mahasiswa: mhs, items: terbaik.map(this.toItem), ipk: ip, totalSks });
  }

  private toItem = (r: {
    kodeMk: string;
    tugas: unknown;
    uts: unknown;
    uas: unknown;
    nilaiAkhir: unknown;
    grade: keyof typeof GRADE_LABEL | null;
    semester: string;
    tahunAjaran: string;
    matakuliah: { namaMk: string; sks: number };
  }) => ({
    kodeMk: r.kodeMk,
    namaMk: r.matakuliah.namaMk,
    sks: r.matakuliah.sks,
    tugas: toNumber(r.tugas as never),
    uts: toNumber(r.uts as never),
    uas: toNumber(r.uas as never),
    nilaiAkhir: toNumber(r.nilaiAkhir as never),
    grade: r.grade ? GRADE_LABEL[r.grade] : null,
    bobot: r.grade ? GRADE_BOBOT[r.grade] : null,
    semester: r.semester,
    tahunAjaran: r.tahunAjaran,
  });

  private async loadKelas(jadwalId: string, actor: Actor) {
    const row = await prisma.jadwalKuliah.findUnique({ where: { id: jadwalId }, select: jadwalSelect });
    if (!row) return fail('NOT_FOUND', 'Jadwal tidak ditemukan');
    const jadwal = toJadwalDto(row);

    if (actor.role === 'DOSEN') {
      if ((await nidnOf(actor.id)) !== jadwal.nidn) return fail('FORBIDDEN', 'Anda bukan dosen pengampu kelas ini');
    } else if (actor.role !== 'ADMIN') {
      return fail('FORBIDDEN', 'Akses ditolak');
    }

    const krs = await prisma.krs.findMany({
      where: { jadwalId, status: KrsStatus.AKTIF },
      select: { mahasiswa: { select: { nim: true, namaMhs: true } } },
      orderBy: { nim: 'asc' },
    });
    return { jadwal, peserta: krs.map((k) => k.mahasiswa) };
  }
}
