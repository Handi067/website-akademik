import { KrsStatus } from '@prisma/client';
import { prisma } from '@/config/database';
import config from '@/config/app';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';
import { GRADE_LABEL } from '@/utils/grading';
import { jadwalSelect, sortJadwal, toJadwalDto } from '@/services/jadwal.service';
import { NilaiService } from '@/services/nilai.service';
import { KrsService } from '@/services/krs.service';

export class DashboardService {
  private nilai = new NilaiService();
  private krs = new KrsService();

  async forUser(user: { id: string; role: string }): Promise<ApiResponse> {
    if (user.role === 'ADMIN') return this.admin();
    if (user.role === 'DOSEN') return this.dosen(user.id);
    if (user.role === 'MAHASISWA') return this.mahasiswa(user.id);
    return fail('FORBIDDEN', 'Akses ditolak');
  }

  private async admin(): Promise<ApiResponse> {
    const periode = config.periodeAktif;
    const [mahasiswa, dosen, matakuliah, jadwal, krsAktif, perAngkatan, perGrade] = await Promise.all([
      prisma.mahasiswa.count(),
      prisma.dosen.count(),
      prisma.matakuliah.count(),
      prisma.jadwalKuliah.count({ where: periode }),
      prisma.krs.count({ where: { ...periode, status: KrsStatus.AKTIF } }),
      prisma.mahasiswa.groupBy({ by: ['angkatan'], _count: { _all: true }, orderBy: { angkatan: 'asc' } }),
      prisma.nilai.groupBy({ by: ['grade'], where: { grade: { not: null } }, _count: { _all: true } }),
    ]);
    const gradeOrder = Object.keys(GRADE_LABEL);
    return ok({
      role: 'ADMIN',
      periode,
      totals: { mahasiswa, dosen, matakuliah, jadwal, krsAktif },
      mahasiswaPerAngkatan: perAngkatan.map((r) => ({ angkatan: r.angkatan, jumlah: r._count._all })),
      distribusiGrade: perGrade
        .sort((a, b) => gradeOrder.indexOf(a.grade!) - gradeOrder.indexOf(b.grade!))
        .map((r) => ({ grade: GRADE_LABEL[r.grade!], jumlah: r._count._all })),
    });
  }

  private async dosen(userId: string): Promise<ApiResponse> {
    const profil = await prisma.dosen.findUnique({
      where: { userId },
      select: { nidn: true, namaDosen: true, departemen: true },
    });
    if (!profil) return fail('FORBIDDEN', 'Akun ini belum terhubung ke data dosen');
    const periode = config.periodeAktif;
    const rows = await prisma.jadwalKuliah.findMany({ where: { nidn: profil.nidn, ...periode }, select: jadwalSelect });
    const jadwal = sortJadwal(rows.map(toJadwalDto));
    return ok({
      role: 'DOSEN',
      periode,
      profil,
      totals: {
        kelas: jadwal.length,
        mahasiswa: jadwal.reduce((s, j) => s + j.terisi, 0),
        sks: jadwal.reduce((s, j) => s + j.sks, 0),
      },
      jadwal,
    });
  }

  private async mahasiswa(userId: string): Promise<ApiResponse> {
    const profil = await prisma.mahasiswa.findUnique({
      where: { userId },
      select: { nim: true, namaMhs: true, jurusan: true, angkatan: true },
    });
    if (!profil) return fail('FORBIDDEN', 'Akun ini belum terhubung ke data mahasiswa');
    const [transkrip, krs] = await Promise.all([this.nilai.getTranskrip(profil.nim), this.krs.getKrs(profil.nim)]);
    return ok({
      role: 'MAHASISWA',
      periode: config.periodeAktif,
      profil,
      totals: {
        ipk: transkrip.data.ipk,
        sksLulus: transkrip.data.totalSks,
        sksSemesterIni: krs.data.totalSks,
        maxSks: krs.data.maxSks,
      },
      jadwal: krs.data.items,
    });
  }
}
