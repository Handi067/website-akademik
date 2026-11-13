import { PeminjamanStatus, Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import config from '@/config/app';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok, pagination } from '@/utils/http';
import { todayDate } from '@/utils/time';

export interface BukuInput {
  kodeBuku: string;
  judul: string;
  pengarang: string;
  penerbit: string;
  tahun: number;
  isbn?: string | null;
  kategori: string;
  jumlah: number;
}

const DAY = 24 * 60 * 60 * 1000;
const today = todayDate;
const toDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const hariTerlambat = (tenggat: Date, kembali: Date) => Math.max(0, Math.round((kembali.getTime() - tenggat.getTime()) / DAY));

const pinjamSelect = {
  id: true,
  kodeBuku: true,
  nim: true,
  tanggalPinjam: true,
  tanggalKembali: true,
  tenggat: true,
  status: true,
  denda: true,
  buku: { select: { judul: true, pengarang: true } },
  mahasiswa: { select: { namaMhs: true } },
} satisfies Prisma.PeminjamanSelect;

type PinjamRow = Prisma.PeminjamanGetPayload<{ select: typeof pinjamSelect }>;

/** Untuk pinjaman yang masih aktif, keterlambatan & denda dihitung berjalan sampai hari ini. */
const toPinjamDto = (p: PinjamRow) => {
  const aktif = !p.tanggalKembali;
  const terlambatHari = hariTerlambat(p.tenggat, p.tanggalKembali ?? today());
  return {
    id: p.id,
    kodeBuku: p.kodeBuku,
    judul: p.buku.judul,
    pengarang: p.buku.pengarang,
    nim: p.nim,
    namaMhs: p.mahasiswa.namaMhs,
    tanggalPinjam: toDate(p.tanggalPinjam),
    tenggat: toDate(p.tenggat),
    tanggalKembali: toDate(p.tanggalKembali),
    status: aktif ? (terlambatHari > 0 ? PeminjamanStatus.TERLAMBAT : PeminjamanStatus.AKTIF) : PeminjamanStatus.DIKEMBALIKAN,
    terlambatHari,
    denda: aktif ? terlambatHari * config.perpustakaan.dendaPerHari : Number(p.denda ?? 0),
  };
};

export class PerpustakaanService {
  /* ───────── Buku ───────── */

  async listBuku(q: { search?: string; kategori?: string; page: number; limit: number; skip: number }): Promise<ApiResponse> {
    const where: Prisma.BukuWhereInput = {
      kategori: q.kategori || undefined,
      OR: q.search
        ? ['judul', 'pengarang', 'kodeBuku', 'isbn'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }))
        : undefined,
    };
    const [rows, total, kategori] = await Promise.all([
      prisma.buku.findMany({ where, orderBy: { judul: 'asc' }, skip: q.skip, take: q.limit }),
      prisma.buku.count({ where }),
      prisma.buku.findMany({ distinct: ['kategori'], select: { kategori: true }, orderBy: { kategori: 'asc' } }),
    ]);
    return ok({ items: rows, kategori: kategori.map((k) => k.kategori), pagination: pagination(q.page, q.limit, total) });
  }

  async createBuku(input: BukuInput): Promise<ApiResponse> {
    const exists = await prisma.buku.findUnique({ where: { kodeBuku: input.kodeBuku }, select: { kodeBuku: true } });
    if (exists) return fail('BUKU_EXISTS', `Kode buku ${input.kodeBuku} sudah dipakai`);
    const row = await prisma.buku.create({ data: { ...input, isbn: input.isbn || null, tersedia: input.jumlah } });
    return ok(row, 'Buku ditambahkan');
  }

  async updateBuku(kodeBuku: string, input: Omit<BukuInput, 'kodeBuku'>): Promise<ApiResponse> {
    return prisma.$transaction(async (tx) => {
      const buku = await tx.buku.findUnique({ where: { kodeBuku }, select: { kodeBuku: true } });
      if (!buku) return fail('NOT_FOUND', 'Buku tidak ditemukan');
      const dipinjam = await tx.peminjaman.count({ where: { kodeBuku, tanggalKembali: null } });
      if (input.jumlah < dipinjam) {
        return fail('JUMLAH_INVALID', `Jumlah eksemplar tidak boleh kurang dari yang sedang dipinjam (${dipinjam})`);
      }
      const row = await tx.buku.update({
        where: { kodeBuku },
        data: { ...input, isbn: input.isbn || null, tersedia: input.jumlah - dipinjam },
      });
      return ok(row, 'Buku diperbarui');
    });
  }

  async removeBuku(kodeBuku: string): Promise<ApiResponse> {
    const buku = await prisma.buku.findUnique({
      where: { kodeBuku },
      select: { _count: { select: { peminjaman: { where: { tanggalKembali: null } } } } },
    });
    if (!buku) return fail('NOT_FOUND', 'Buku tidak ditemukan');
    if (buku._count.peminjaman > 0) return fail('IN_USE', 'Buku masih dipinjam sehingga tidak dapat dihapus');
    await prisma.buku.delete({ where: { kodeBuku } });
    return ok(null, 'Buku dihapus');
  }

  /* ───────── Peminjaman ───────── */

  async listPeminjaman(f: { nim?: string; aktif?: boolean }): Promise<ApiResponse> {
    const rows = await prisma.peminjaman.findMany({
      where: { nim: f.nim, tanggalKembali: f.aktif ? null : undefined },
      select: pinjamSelect,
      orderBy: [{ tanggalKembali: { sort: 'desc', nulls: 'first' } }, { tanggalPinjam: 'desc' }],
    });
    return ok(rows.map(toPinjamDto));
  }

  /** Dicatat petugas (admin). Stok dikurangi secara atomik agar tidak minus saat bersamaan. */
  async pinjam(nim: string, kodeBuku: string): Promise<ApiResponse> {
    const { lamaPinjamHari, maxPinjam } = config.perpustakaan;
    return prisma.$transaction(
      async (tx) => {
        const mhs = await tx.mahasiswa.findUnique({ where: { nim }, select: { nim: true } });
        if (!mhs) return fail('MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan');
        const buku = await tx.buku.findUnique({ where: { kodeBuku }, select: { judul: true } });
        if (!buku) return fail('BUKU_NOT_FOUND', 'Buku tidak ditemukan');

        const aktif = await tx.peminjaman.findMany({ where: { nim, tanggalKembali: null }, select: { kodeBuku: true, tenggat: true } });
        if (aktif.some((a) => a.tenggat < today())) {
          return fail('ADA_TERLAMBAT', 'Mahasiswa masih memiliki pinjaman yang terlambat dikembalikan');
        }
        if (aktif.some((a) => a.kodeBuku === kodeBuku)) return fail('SUDAH_DIPINJAM', 'Mahasiswa sedang meminjam buku ini');
        if (aktif.length >= maxPinjam) return fail('MAX_PINJAM', `Maksimal ${maxPinjam} buku dipinjam bersamaan`);

        const { count } = await tx.buku.updateMany({ where: { kodeBuku, tersedia: { gt: 0 } }, data: { tersedia: { decrement: 1 } } });
        if (!count) return fail('STOK_HABIS', `Semua eksemplar "${buku.judul}" sedang dipinjam`);

        const mulai = today();
        const row = await tx.peminjaman.create({
          data: { nim, kodeBuku, tanggalPinjam: mulai, tenggat: new Date(mulai.getTime() + lamaPinjamHari * DAY) },
          select: pinjamSelect,
        });
        return ok(toPinjamDto(row), `Peminjaman dicatat, kembali paling lambat ${toDate(row.tenggat)}`);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async kembalikan(id: string): Promise<ApiResponse> {
    return prisma.$transaction(async (tx) => {
      const p = await tx.peminjaman.findUnique({ where: { id }, select: pinjamSelect });
      if (!p) return fail('NOT_FOUND', 'Peminjaman tidak ditemukan');
      if (p.tanggalKembali) return fail('SUDAH_KEMBALI', 'Buku sudah dikembalikan');

      const kembali = today();
      const telat = hariTerlambat(p.tenggat, kembali);
      const row = await tx.peminjaman.update({
        where: { id },
        data: {
          tanggalKembali: kembali,
          status: PeminjamanStatus.DIKEMBALIKAN,
          denda: telat * config.perpustakaan.dendaPerHari,
        },
        select: pinjamSelect,
      });
      await tx.buku.update({ where: { kodeBuku: p.kodeBuku }, data: { tersedia: { increment: 1 } } });
      const dto = toPinjamDto(row);
      return ok(dto, telat ? `Buku dikembalikan, terlambat ${telat} hari, denda Rp${dto.denda.toLocaleString('id-ID')}` : 'Buku dikembalikan');
    });
  }
}
