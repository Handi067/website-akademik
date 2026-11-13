import { KrsStatus, StatusHadir } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';
import { nidnOf } from '@/utils/actor';
import { jadwalSelect, toJadwalDto } from '@/services/jadwal.service';

interface Actor {
  id: string;
  role: string;
}

export interface PertemuanInput {
  tanggal: string; // YYYY-MM-DD
  topik?: string | null;
  materi?: string | null;
}

export interface AbsensiInput {
  nim: string;
  statusHadir: StatusHadir;
  keterangan?: string | null;
}

type Jadwal = ReturnType<typeof toJadwalDto>;

const pertemuanSelect = {
  id: true,
  pertemuanKe: true,
  tanggal: true,
  topik: true,
  materi: true,
  _count: { select: { absensi: { where: { statusHadir: StatusHadir.HADIR } } } },
} as const;

const toDate = (d: Date) => d.toISOString().slice(0, 10);

/** Persentase kehadiran: HADIR dibagi jumlah pertemuan (IZIN/SAKIT/ALPA/belum diisi = tidak hadir). */
const persen = (hadir: number, total: number) => (total ? Math.round((hadir / total) * 1000) / 10 : null);

const rekapKosong = () => ({ HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 });

/**
 * Pertemuan dikaitkan ke kelas lewat (kodeMk, nidn) serta rentang tanggal tidak dibatasi,
 * karena model Pertemuan belum menyimpan jadwalId/periode.
 */
const kelasWhere = (j: Jadwal) => ({ kodeMk: j.kodeMk, nidn: j.nidn });

export class AbsensiService {
  /** Ringkasan kelas: daftar pertemuan + rekap kehadiran per peserta. */
  async getKelas(jadwalId: string, actor: Actor): Promise<ApiResponse> {
    const access = await this.loadKelas(jadwalId, actor);
    if ('success' in access) return access;
    const { jadwal, peserta } = access;

    const pertemuan = await prisma.pertemuan.findMany({
      where: kelasWhere(jadwal),
      select: pertemuanSelect,
      orderBy: { pertemuanKe: 'asc' },
    });
    const absensi = await prisma.absensi.findMany({
      where: { pertemuanId: { in: pertemuan.map((p) => p.id) } },
      select: { nim: true, statusHadir: true },
    });

    const rekap = new Map(peserta.map((p) => [p.nim, rekapKosong()]));
    for (const a of absensi) {
      const r = rekap.get(a.nim);
      if (r) r[a.statusHadir]++;
    }

    return ok({
      jadwal,
      pertemuan: pertemuan.map((p) => ({
        id: p.id,
        pertemuanKe: p.pertemuanKe,
        tanggal: toDate(p.tanggal),
        topik: p.topik,
        materi: p.materi,
        jumlahHadir: p._count.absensi,
      })),
      peserta: peserta.map((p) => {
        const r = rekap.get(p.nim)!;
        return { nim: p.nim, namaMhs: p.namaMhs, ...r, persentase: persen(r.HADIR, pertemuan.length) };
      }),
    });
  }

  async createPertemuan(jadwalId: string, actor: Actor, input: PertemuanInput): Promise<ApiResponse> {
    const access = await this.loadKelas(jadwalId, actor);
    if ('success' in access) return access;
    const { jadwal } = access;

    const last = await prisma.pertemuan.findFirst({
      where: kelasWhere(jadwal),
      orderBy: { pertemuanKe: 'desc' },
      select: { pertemuanKe: true },
    });
    const row = await prisma.pertemuan.create({
      data: {
        ...kelasWhere(jadwal),
        pertemuanKe: (last?.pertemuanKe ?? 0) + 1,
        tanggal: new Date(`${input.tanggal}T00:00:00Z`),
        topik: input.topik || null,
        materi: input.materi || null,
      },
      select: { id: true, pertemuanKe: true },
    });
    return ok(row, `Pertemuan ke-${row.pertemuanKe} dibuat`);
  }

  /** Lembar absensi satu pertemuan: semua peserta kelas beserta status (null = belum diisi). */
  async getPertemuan(id: string, actor: Actor): Promise<ApiResponse> {
    const access = await this.loadPertemuan(id, actor);
    if ('success' in access) return access;
    const { pertemuan, peserta } = access;

    const absensi = await prisma.absensi.findMany({
      where: { pertemuanId: id },
      select: { nim: true, statusHadir: true, keterangan: true },
    });
    const byNim = new Map(absensi.map((a) => [a.nim, a]));

    return ok({
      pertemuan,
      peserta: peserta.map((p) => ({
        nim: p.nim,
        namaMhs: p.namaMhs,
        statusHadir: byNim.get(p.nim)?.statusHadir ?? null,
        keterangan: byNim.get(p.nim)?.keterangan ?? null,
      })),
    });
  }

  async simpanAbsensi(id: string, actor: Actor, items: AbsensiInput[]): Promise<ApiResponse> {
    const access = await this.loadPertemuan(id, actor);
    if ('success' in access) return access;

    const pesertaNim = new Set(access.peserta.map((p) => p.nim));
    const bukanPeserta = items.filter((i) => !pesertaNim.has(i.nim)).map((i) => i.nim);
    if (bukanPeserta.length) {
      return fail('BUKAN_PESERTA', `NIM berikut bukan peserta kelas ini: ${bukanPeserta.join(', ')}`);
    }

    await prisma.$transaction(
      items.map((i) =>
        prisma.absensi.upsert({
          where: { pertemuanId_nim: { pertemuanId: id, nim: i.nim } },
          create: { pertemuanId: id, nim: i.nim, statusHadir: i.statusHadir, keterangan: i.keterangan || null },
          update: { statusHadir: i.statusHadir, keterangan: i.keterangan || null },
        })
      )
    );
    return this.getPertemuan(id, actor).then((r) => (r.success ? { ...r, message: 'Absensi disimpan' } : r));
  }

  async removePertemuan(id: string, actor: Actor): Promise<ApiResponse> {
    const access = await this.loadPertemuan(id, actor);
    if ('success' in access) return access;
    await prisma.pertemuan.delete({ where: { id } });
    return ok(null, 'Pertemuan dihapus');
  }

  /** Rekap kehadiran mahasiswa untuk setiap kelas yang diambil (KRS aktif) pada periode tertentu. */
  async getRekapMahasiswa(nim: string, periode: { semester?: string; tahunAjaran?: string }): Promise<ApiResponse> {
    const krs = await prisma.krs.findMany({
      where: { nim, status: KrsStatus.AKTIF, semester: periode.semester, tahunAjaran: periode.tahunAjaran },
      select: { jadwalKuliah: { select: jadwalSelect } },
    });

    const data = await Promise.all(
      krs.map(async (k) => {
        const jadwal = toJadwalDto(k.jadwalKuliah);
        const pertemuan = await prisma.pertemuan.findMany({
          where: kelasWhere(jadwal),
          select: {
            id: true,
            pertemuanKe: true,
            tanggal: true,
            topik: true,
            absensi: { where: { nim }, select: { statusHadir: true, keterangan: true } },
          },
          orderBy: { pertemuanKe: 'asc' },
        });
        const r = rekapKosong();
        for (const p of pertemuan) if (p.absensi[0]) r[p.absensi[0].statusHadir]++;
        return {
          jadwalId: jadwal.id,
          kodeMk: jadwal.kodeMk,
          namaMk: jadwal.namaMk,
          namaDosen: jadwal.namaDosen,
          totalPertemuan: pertemuan.length,
          ...r,
          persentase: persen(r.HADIR, pertemuan.length),
          detail: pertemuan.map((p) => ({
            pertemuanKe: p.pertemuanKe,
            tanggal: toDate(p.tanggal),
            topik: p.topik,
            statusHadir: p.absensi[0]?.statusHadir ?? null,
            keterangan: p.absensi[0]?.keterangan ?? null,
          })),
        };
      })
    );
    return ok(data.sort((a, b) => a.kodeMk.localeCompare(b.kodeMk)));
  }

  private async loadKelas(jadwalId: string, actor: Actor) {
    const row = await prisma.jadwalKuliah.findUnique({ where: { id: jadwalId }, select: jadwalSelect });
    if (!row) return fail('NOT_FOUND', 'Jadwal tidak ditemukan');
    const jadwal = toJadwalDto(row);

    const denied = await this.checkPengampu(jadwal.nidn, actor);
    if (denied) return denied;

    const krs = await prisma.krs.findMany({
      where: { jadwalId, status: KrsStatus.AKTIF },
      select: { mahasiswa: { select: { nim: true, namaMhs: true } } },
      orderBy: { nim: 'asc' },
    });
    return { jadwal, peserta: krs.map((k) => k.mahasiswa) };
  }

  /** Peserta pertemuan = mahasiswa dengan KRS aktif di kelas (kodeMk, nidn) yang sama. */
  private async loadPertemuan(id: string, actor: Actor) {
    const p = await prisma.pertemuan.findUnique({
      where: { id },
      select: {
        id: true,
        kodeMk: true,
        nidn: true,
        pertemuanKe: true,
        tanggal: true,
        topik: true,
        materi: true,
        matakuliah: { select: { namaMk: true } },
      },
    });
    if (!p) return fail('NOT_FOUND', 'Pertemuan tidak ditemukan');

    const denied = await this.checkPengampu(p.nidn, actor);
    if (denied) return denied;

    const krs = await prisma.krs.findMany({
      where: { status: KrsStatus.AKTIF, jadwalKuliah: { kodeMk: p.kodeMk, nidn: p.nidn } },
      select: { mahasiswa: { select: { nim: true, namaMhs: true } } },
      orderBy: { nim: 'asc' },
      distinct: ['nim'],
    });
    return {
      pertemuan: {
        id: p.id,
        kodeMk: p.kodeMk,
        namaMk: p.matakuliah.namaMk,
        pertemuanKe: p.pertemuanKe,
        tanggal: toDate(p.tanggal),
        topik: p.topik,
        materi: p.materi,
      },
      peserta: krs.map((k) => k.mahasiswa),
    };
  }

  private async checkPengampu(nidn: string, actor: Actor): Promise<ApiResponse | null> {
    if (actor.role === 'ADMIN') return null;
    if (actor.role === 'DOSEN' && (await nidnOf(actor.id)) === nidn) return null;
    return fail('FORBIDDEN', actor.role === 'DOSEN' ? 'Anda bukan dosen pengampu kelas ini' : 'Akses ditolak');
  }
}
