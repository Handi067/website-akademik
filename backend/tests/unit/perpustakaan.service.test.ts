import { prismaMock, resetPrismaMock } from '../helpers/prisma-mock';

jest.mock('@/config/database', () => ({ prisma: require('../helpers/prisma-mock').prismaMock }));

import { PerpustakaanService } from '@/services/perpustakaan.service';
import { todayDate } from '@/utils/time';

const service = new PerpustakaanService();
const DAY = 864e5;
const today = todayDate();
const hari = (n: number) => new Date(today.getTime() + n * DAY);

const pinjamRow = (o: Partial<{ tenggat: Date; tanggalKembali: Date | null; denda: number }> = {}) => ({
  id: 'p-1',
  kodeBuku: 'BK001',
  nim: '2021001001',
  tanggalPinjam: hari(-10),
  tanggalKembali: o.tanggalKembali ?? null,
  tenggat: o.tenggat ?? hari(-3),
  status: 'AKTIF',
  denda: o.denda ?? 0,
  buku: { judul: 'Algoritma', pengarang: 'Tim' },
  mahasiswa: { namaMhs: 'Budi' },
});

beforeEach(() => {
  resetPrismaMock();
  prismaMock.mahasiswa.findUnique.mockResolvedValue({ nim: '2021001001' });
  prismaMock.buku.findUnique.mockResolvedValue({ judul: 'Algoritma' });
  prismaMock.peminjaman.findMany.mockResolvedValue([]);
  prismaMock.buku.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.peminjaman.create.mockImplementation(({ data }: any) => Promise.resolve({ ...pinjamRow(), ...data, tanggalKembali: null }));
});

describe('PerpustakaanService.pinjam', () => {
  it('mencatat pinjaman dengan tenggat 7 hari dan mengurangi stok secara atomik', async () => {
    const r = await service.pinjam('2021001001', 'BK001');
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ tanggalPinjam: today.toISOString().slice(0, 10), tenggat: hari(7).toISOString().slice(0, 10), denda: 0 });
    expect(prismaMock.buku.updateMany).toHaveBeenCalledWith({ where: { kodeBuku: 'BK001', tersedia: { gt: 0 } }, data: { tersedia: { decrement: 1 } } });
  });

  it('STOK_HABIS bila tidak ada eksemplar tersisa', async () => {
    prismaMock.buku.updateMany.mockResolvedValue({ count: 0 });
    expect((await service.pinjam('2021001001', 'BK001')).error).toBe('STOK_HABIS');
    expect(prismaMock.peminjaman.create).not.toHaveBeenCalled();
  });

  it('ADA_TERLAMBAT bila masih punya pinjaman lewat tenggat', async () => {
    prismaMock.peminjaman.findMany.mockResolvedValue([{ kodeBuku: 'BK009', tenggat: hari(-1) }]);
    expect((await service.pinjam('2021001001', 'BK001')).error).toBe('ADA_TERLAMBAT');
  });

  it('tenggat hari ini belum dianggap terlambat', async () => {
    prismaMock.peminjaman.findMany.mockResolvedValue([{ kodeBuku: 'BK009', tenggat: today }]);
    expect((await service.pinjam('2021001001', 'BK001')).success).toBe(true);
  });

  it('SUDAH_DIPINJAM untuk judul yang sedang dipinjam', async () => {
    prismaMock.peminjaman.findMany.mockResolvedValue([{ kodeBuku: 'BK001', tenggat: hari(3) }]);
    expect((await service.pinjam('2021001001', 'BK001')).error).toBe('SUDAH_DIPINJAM');
  });

  it('MAX_PINJAM bila sudah meminjam 3 buku', async () => {
    prismaMock.peminjaman.findMany.mockResolvedValue(['A', 'B', 'C'].map((k) => ({ kodeBuku: k, tenggat: hari(3) })));
    expect((await service.pinjam('2021001001', 'BK001')).error).toBe('MAX_PINJAM');
    expect(prismaMock.buku.updateMany).not.toHaveBeenCalled();
  });

  it('MAHASISWA_NOT_FOUND / BUKU_NOT_FOUND', async () => {
    prismaMock.mahasiswa.findUnique.mockResolvedValueOnce(null);
    expect((await service.pinjam('x', 'BK001')).error).toBe('MAHASISWA_NOT_FOUND');
    prismaMock.buku.findUnique.mockResolvedValueOnce(null);
    expect((await service.pinjam('2021001001', 'X')).error).toBe('BUKU_NOT_FOUND');
  });
});

describe('PerpustakaanService.kembalikan', () => {
  beforeEach(() => {
    prismaMock.peminjaman.update.mockImplementation(({ data }: any) => Promise.resolve(pinjamRow({ ...data, tenggat: hari(-3) })));
  });

  it('menghitung denda Rp1.000 × hari terlambat dan mengembalikan stok', async () => {
    prismaMock.peminjaman.findUnique.mockResolvedValue(pinjamRow({ tenggat: hari(-3) }));
    const r = await service.kembalikan('p-1');
    expect(r.success).toBe(true);
    expect(prismaMock.peminjaman.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ denda: 3000, status: 'DIKEMBALIKAN' }) }));
    expect(prismaMock.buku.update).toHaveBeenCalledWith({ where: { kodeBuku: 'BK001' }, data: { tersedia: { increment: 1 } } });
    expect(r.message).toContain('terlambat 3 hari');
  });

  it('tanpa denda bila dikembalikan sebelum tenggat', async () => {
    prismaMock.peminjaman.findUnique.mockResolvedValue(pinjamRow({ tenggat: hari(2) }));
    await service.kembalikan('p-1');
    expect(prismaMock.peminjaman.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ denda: 0 }) }));
  });

  it('SUDAH_KEMBALI tidak mengubah stok dua kali', async () => {
    prismaMock.peminjaman.findUnique.mockResolvedValue(pinjamRow({ tanggalKembali: hari(-1) }));
    expect((await service.kembalikan('p-1')).error).toBe('SUDAH_KEMBALI');
    expect(prismaMock.buku.update).not.toHaveBeenCalled();
  });
});

describe('PerpustakaanService.listPeminjaman', () => {
  it('denda berjalan untuk pinjaman aktif yang terlambat', async () => {
    prismaMock.peminjaman.findMany.mockResolvedValue([pinjamRow({ tenggat: hari(-4) })]);
    const r = await service.listPeminjaman({});
    expect(r.data[0]).toMatchObject({ status: 'TERLAMBAT', terlambatHari: 4, denda: 4000 });
  });

  it('pinjaman yang sudah kembali memakai denda tersimpan', async () => {
    prismaMock.peminjaman.findMany.mockResolvedValue([pinjamRow({ tenggat: hari(-4), tanggalKembali: hari(-2), denda: 2000 })]);
    const r = await service.listPeminjaman({});
    expect(r.data[0]).toMatchObject({ status: 'DIKEMBALIKAN', terlambatHari: 2, denda: 2000 });
  });
});

describe('PerpustakaanService.updateBuku', () => {
  it('JUMLAH_INVALID bila jumlah < yang sedang dipinjam; tersedia dihitung ulang', async () => {
    prismaMock.buku.findUnique.mockResolvedValue({ kodeBuku: 'BK001' });
    prismaMock.peminjaman.count.mockResolvedValue(2);
    const input = { judul: 'A', pengarang: 'B', penerbit: 'C', tahun: 2020, kategori: 'K', jumlah: 1 };
    expect((await service.updateBuku('BK001', input)).error).toBe('JUMLAH_INVALID');

    prismaMock.buku.update.mockResolvedValue({});
    await service.updateBuku('BK001', { ...input, jumlah: 5 });
    expect(prismaMock.buku.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ jumlah: 5, tersedia: 3 }) }));
  });
});
