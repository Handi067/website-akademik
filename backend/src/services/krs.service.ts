import { KrsStatus, Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import config from '@/config/app';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';
import { isLulus } from '@/utils/grading';
import { jadwalSelect, sortJadwal, toJadwalDto } from '@/services/jadwal.service';

const periodeAktif = () => config.periodeAktif;

export class KrsService {
  /** KRS mahasiswa untuk satu periode (default: periode aktif). */
  async getKrs(nim: string, periode = periodeAktif()): Promise<ApiResponse> {
    const rows = await prisma.krs.findMany({
      where: { nim, semester: periode.semester, tahunAjaran: periode.tahunAjaran, status: KrsStatus.AKTIF },
      select: { id: true, createdAt: true, jadwalKuliah: { select: jadwalSelect } },
    });
    const items = sortJadwal(rows.map((r) => ({ krsId: r.id, ...toJadwalDto(r.jadwalKuliah) })));
    return ok({
      periode,
      editable: periode.semester === periodeAktif().semester && periode.tahunAjaran === periodeAktif().tahunAjaran,
      totalSks: items.reduce((s, i) => s + i.sks, 0),
      maxSks: config.maxSks,
      items,
    });
  }

  /** Kelas yang ditawarkan pada periode aktif, beserta status untuk mahasiswa ini. */
  async getPenawaran(nim: string): Promise<ApiResponse> {
    const { semester, tahunAjaran } = periodeAktif();
    const [jadwal, diambil, lulus] = await Promise.all([
      prisma.jadwalKuliah.findMany({
        where: { semester, tahunAjaran },
        select: { ...jadwalSelect, matakuliah: { select: { kodeMK: true, namaMk: true, sks: true, kodePrasyarat: true } } },
      }),
      prisma.krs.findMany({
        where: { nim, semester, tahunAjaran, status: KrsStatus.AKTIF },
        select: { jadwalId: true },
      }),
      this.mkLulus(nim),
    ]);
    const diambilIds = new Set(diambil.map((k) => k.jadwalId));
    const items = jadwal.map((j) => ({
      ...toJadwalDto(j),
      kodePrasyarat: j.matakuliah.kodePrasyarat,
      prasyaratTerpenuhi: !j.matakuliah.kodePrasyarat || lulus.has(j.matakuliah.kodePrasyarat),
      diambil: diambilIds.has(j.id),
    }));
    return ok(sortJadwal(items));
  }

  async add(nim: string, jadwalId: string): Promise<ApiResponse> {
    // Serializable: pengecekan kuota/bentrok dan insert terjadi atomik terhadap pendaftar lain.
    return prisma.$transaction(
      async (tx) => {
        const jadwal = await tx.jadwalKuliah.findUnique({
          where: { id: jadwalId },
          select: { ...jadwalSelect, matakuliah: { select: { kodeMK: true, namaMk: true, sks: true, kodePrasyarat: true } } },
        });
        if (!jadwal) return fail('JADWAL_NOT_FOUND', 'Jadwal tidak ditemukan');

        const { semester, tahunAjaran } = periodeAktif();
        if (jadwal.semester !== semester || jadwal.tahunAjaran !== tahunAjaran) {
          return fail('PERIODE_TIDAK_AKTIF', `KRS hanya dapat diisi untuk periode ${semester} ${tahunAjaran}`);
        }

        const target = toJadwalDto(jadwal);
        const current = (
          await tx.krs.findMany({
            where: { nim, semester, tahunAjaran, status: KrsStatus.AKTIF },
            select: { jadwalKuliah: { select: jadwalSelect } },
          })
        ).map((k) => toJadwalDto(k.jadwalKuliah));

        if (current.some((c) => c.id === jadwalId)) return fail('KRS_EXISTS', 'Kelas ini sudah ada di KRS');
        if (current.some((c) => c.kodeMk === target.kodeMk)) {
          return fail('MK_SUDAH_DIAMBIL', `${target.namaMk} sudah diambil di kelas lain`);
        }
        if (target.terisi >= target.kapasitas) return fail('KELAS_PENUH', 'Kelas sudah penuh');

        const bentrok = current.find(
          (c) => c.hari === target.hari && c.jamMulai < target.jamSelesai && target.jamMulai < c.jamSelesai
        );
        if (bentrok) {
          return fail(
            'JADWAL_CONFLICT',
            `Bentrok dengan ${bentrok.namaMk} (${bentrok.hari} ${bentrok.jamMulai}–${bentrok.jamSelesai})`
          );
        }

        const totalSks = current.reduce((s, c) => s + c.sks, 0);
        if (totalSks + target.sks > config.maxSks) {
          return fail('MAX_SKS', `Melebihi batas ${config.maxSks} SKS (saat ini ${totalSks} SKS)`);
        }

        const prasyarat = jadwal.matakuliah.kodePrasyarat;
        if (prasyarat && !(await this.mkLulus(nim, tx)).has(prasyarat)) {
          return fail('PRASYARAT_BELUM_LULUS', `Harus lulus mata kuliah prasyarat ${prasyarat} terlebih dahulu`);
        }

        const krs = await tx.krs.create({
          data: { nim, jadwalId, semester, tahunAjaran, status: KrsStatus.AKTIF },
          select: { id: true },
        });
        return ok({ krsId: krs.id, ...target, terisi: target.terisi + 1 }, `${target.namaMk} ditambahkan ke KRS`);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async remove(nim: string, krsId: string): Promise<ApiResponse> {
    const krs = await prisma.krs.findFirst({
      where: { id: krsId, nim },
      select: { semester: true, tahunAjaran: true, jadwalKuliah: { select: { kodeMk: true } } },
    });
    if (!krs) return fail('NOT_FOUND', 'Data KRS tidak ditemukan');

    const { semester, tahunAjaran } = periodeAktif();
    if (krs.semester !== semester || krs.tahunAjaran !== tahunAjaran) {
      return fail('PERIODE_TIDAK_AKTIF', 'KRS periode lalu tidak dapat diubah');
    }
    const sudahDinilai = await prisma.nilai.findUnique({
      where: { nim_kodeMk_semester_tahunAjaran: { nim, kodeMk: krs.jadwalKuliah.kodeMk, semester, tahunAjaran } },
      select: { id: true },
    });
    if (sudahDinilai) return fail('IN_USE', 'Mata kuliah ini sudah memiliki nilai sehingga tidak dapat dibatalkan');

    await prisma.krs.delete({ where: { id: krsId } });
    return ok(null, 'Mata kuliah dihapus dari KRS');
  }

  /** Kode MK yang sudah lulus (grade selain E). */
  private async mkLulus(nim: string, db: Prisma.TransactionClient = prisma): Promise<Set<string>> {
    const nilai = await db.nilai.findMany({ where: { nim, grade: { not: null } }, select: { kodeMk: true, grade: true } });
    return new Set(nilai.filter((n) => isLulus(n.grade)).map((n) => n.kodeMk));
  }
}
