import { prismaMock, resetPrismaMock, jadwalRow } from '../helpers/prisma-mock';

jest.mock('@/config/database', () => ({ prisma: require('../helpers/prisma-mock').prismaMock }));

import { KrsService } from '@/services/krs.service';

const service = new KrsService();
const NIM = '2021001001';

/** Skenario default: kelas valid, belum ada KRS, tidak ada tunggakan, belum lulus apa pun. */
const arrange = (o: {
  target?: ReturnType<typeof jadwalRow> | null;
  current?: ReturnType<typeof jadwalRow>[];
  lulus?: { kodeMk: string; grade: string }[];
  tunggakan?: { jumlah: number; tenggatWaktu: Date } | null;
} = {}) => {
  prismaMock.jadwalKuliah.findUnique.mockResolvedValue(o.target === undefined ? jadwalRow({ id: 'target' }) : o.target);
  prismaMock.tagihan.findFirst.mockResolvedValue(o.tunggakan ?? null);
  prismaMock.krs.findMany.mockResolvedValue((o.current ?? []).map((j) => ({ jadwalKuliah: j })));
  prismaMock.nilai.findMany.mockResolvedValue(o.lulus ?? []);
  prismaMock.krs.create.mockResolvedValue({ id: 'krs-baru' });
};

beforeEach(() => resetPrismaMock());

describe('KrsService.add', () => {
  it('berhasil menambah kelas dan menghitung peserta', async () => {
    arrange({ target: jadwalRow({ id: 'target', terisi: 5 }) });
    const r = await service.add(NIM, 'target');
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ krsId: 'krs-baru', terisi: 6 });
    expect(prismaMock.krs.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nim: NIM, jadwalId: 'target', semester: 'Ganjil', tahunAjaran: '2025/2026' }) })
    );
  });

  it('JADWAL_NOT_FOUND bila jadwal tidak ada', async () => {
    arrange({ target: null });
    expect((await service.add(NIM, 'x')).error).toBe('JADWAL_NOT_FOUND');
  });

  it('PERIODE_TIDAK_AKTIF untuk jadwal periode lain', async () => {
    arrange({ target: jadwalRow({ id: 'target', tahunAjaran: '2024/2025' }) });
    expect((await service.add(NIM, 'target')).error).toBe('PERIODE_TIDAK_AKTIF');
  });

  it('UKT_BELUM_LUNAS bila ada UKT lewat tenggat — dicek sebelum aturan lain', async () => {
    arrange({ tunggakan: { jumlah: 5_000_000, tenggatWaktu: new Date('2020-01-01T00:00:00Z') } });
    const r = await service.add(NIM, 'target');
    expect(r.error).toBe('UKT_BELUM_LUNAS');
    expect(r.message).toContain('2020-01-01');
    expect(prismaMock.krs.create).not.toHaveBeenCalled();
  });

  it('KRS_EXISTS bila kelas yang sama sudah diambil', async () => {
    arrange({ current: [jadwalRow({ id: 'target' })] });
    expect((await service.add(NIM, 'target')).error).toBe('KRS_EXISTS');
  });

  it('MK_SUDAH_DIAMBIL bila mata kuliah sama di kelas lain', async () => {
    arrange({ current: [jadwalRow({ id: 'kelas-lain', hari: 'RABU' })] });
    expect((await service.add(NIM, 'target')).error).toBe('MK_SUDAH_DIAMBIL');
  });

  it('KELAS_PENUH bila kapasitas terisi', async () => {
    arrange({ target: jadwalRow({ id: 'target', kapasitas: 10, terisi: 10 }) });
    expect((await service.add(NIM, 'target')).error).toBe('KELAS_PENUH');
  });

  it('JADWAL_CONFLICT bila jam beririsan di hari yang sama', async () => {
    arrange({ current: [jadwalRow({ id: 'lain', kodeMk: 'IF200', hari: 'SENIN', mulai: '09:00', selesai: '11:00' })] });
    expect((await service.add(NIM, 'target')).error).toBe('JADWAL_CONFLICT');
  });

  it('tidak bentrok bila jam hanya bersentuhan (selesai 08:00, mulai 08:00)', async () => {
    arrange({ current: [jadwalRow({ id: 'lain', kodeMk: 'IF200', hari: 'SENIN', mulai: '06:00', selesai: '08:00' })] });
    expect((await service.add(NIM, 'target')).success).toBe(true);
  });

  it('MAX_SKS bila total melebihi batas (24)', async () => {
    const current = Array.from({ length: 7 }, (_, i) =>
      jadwalRow({ id: `k${i}`, kodeMk: `MK${i}`, sks: 3, hari: ['SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU', 'SELASA'][i], mulai: i === 6 ? '13:00' : '08:00', selesai: i === 6 ? '15:00' : '10:00' })
    ); // 21 SKS
    arrange({ current, target: jadwalRow({ id: 'target', sks: 4 }) });
    expect((await service.add(NIM, 'target')).error).toBe('MAX_SKS');
  });

  it('tepat di batas SKS masih diterima', async () => {
    const current = Array.from({ length: 7 }, (_, i) =>
      jadwalRow({ id: `k${i}`, kodeMk: `MK${i}`, sks: 3, hari: ['SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU', 'SELASA'][i], mulai: i === 6 ? '13:00' : '08:00', selesai: i === 6 ? '15:00' : '10:00' })
    ); // 21 SKS + 3 = 24
    arrange({ current, target: jadwalRow({ id: 'target', sks: 3 }) });
    expect((await service.add(NIM, 'target')).success).toBe(true);
  });

  it('PRASYARAT_BELUM_LULUS bila prasyarat belum diambil', async () => {
    arrange({ target: jadwalRow({ id: 'target', kodeMk: 'IF102', prasyarat: 'IF101' }) });
    expect((await service.add(NIM, 'target')).error).toBe('PRASYARAT_BELUM_LULUS');
  });

  it('PRASYARAT_BELUM_LULUS bila prasyarat bernilai E', async () => {
    arrange({ target: jadwalRow({ id: 'target', kodeMk: 'IF102', prasyarat: 'IF101' }), lulus: [{ kodeMk: 'IF101', grade: 'E' }] });
    expect((await service.add(NIM, 'target')).error).toBe('PRASYARAT_BELUM_LULUS');
  });

  it('diterima bila prasyarat sudah lulus (grade D ke atas)', async () => {
    arrange({ target: jadwalRow({ id: 'target', kodeMk: 'IF102', prasyarat: 'IF101' }), lulus: [{ kodeMk: 'IF101', grade: 'D' }] });
    expect((await service.add(NIM, 'target')).success).toBe(true);
  });

  it('dijalankan dalam transaksi Serializable', async () => {
    arrange();
    await service.add(NIM, 'target');
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
});

describe('KrsService.remove', () => {
  const krs = (o: Partial<{ semester: string; tahunAjaran: string }> = {}) => ({
    semester: o.semester ?? 'Ganjil',
    tahunAjaran: o.tahunAjaran ?? '2025/2026',
    jadwalKuliah: { kodeMk: 'IF101' },
  });

  it('NOT_FOUND bila KRS bukan milik mahasiswa', async () => {
    prismaMock.krs.findFirst.mockResolvedValue(null);
    expect((await service.remove(NIM, 'k')).error).toBe('NOT_FOUND');
  });

  it('PERIODE_TIDAK_AKTIF untuk KRS periode lalu', async () => {
    prismaMock.krs.findFirst.mockResolvedValue(krs({ tahunAjaran: '2024/2025' }));
    expect((await service.remove(NIM, 'k')).error).toBe('PERIODE_TIDAK_AKTIF');
  });

  it('IN_USE bila mata kuliah sudah dinilai', async () => {
    prismaMock.krs.findFirst.mockResolvedValue(krs());
    prismaMock.nilai.findUnique.mockResolvedValue({ id: 'n' });
    expect((await service.remove(NIM, 'k')).error).toBe('IN_USE');
    expect(prismaMock.krs.delete).not.toHaveBeenCalled();
  });

  it('menghapus bila belum dinilai', async () => {
    prismaMock.krs.findFirst.mockResolvedValue(krs());
    prismaMock.nilai.findUnique.mockResolvedValue(null);
    expect((await service.remove(NIM, 'k')).success).toBe(true);
    expect(prismaMock.krs.delete).toHaveBeenCalledWith({ where: { id: 'k' } });
  });
});
