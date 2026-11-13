import { JenisTagihan, Prisma, StatusPembayaran } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { fail, ok } from '@/utils/http';
import { todayDate } from '@/utils/time';

export interface TagihanInput {
  nim: string;
  jenisTagihan: JenisTagihan;
  jumlah: number;
  tenggatWaktu: string; // YYYY-MM-DD
  keterangan?: string | null;
}

export interface KonfirmasiInput {
  metodePembayaran: string;
  nomorReferensi: string;
}

const tagihanSelect = {
  id: true,
  nim: true,
  jenisTagihan: true,
  jumlah: true,
  status: true,
  tenggatWaktu: true,
  keterangan: true,
  createdAt: true,
  mahasiswa: { select: { namaMhs: true, jurusan: true } },
  pembayaran: {
    select: {
      id: true,
      metodePembayaran: true,
      transactionId: true,
      waktuTransaksi: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.TagihanSelect;

type TagihanRow = Prisma.TagihanGetPayload<{ select: typeof tagihanSelect }>;

const toDate = (d: Date) => d.toISOString().slice(0, 10);
const startOfToday = todayDate;

export const toTagihanDto = (t: TagihanRow) => ({
  id: t.id,
  nim: t.nim,
  namaMhs: t.mahasiswa.namaMhs,
  jurusan: t.mahasiswa.jurusan,
  jenisTagihan: t.jenisTagihan,
  jumlah: Number(t.jumlah),
  status: t.status,
  tenggatWaktu: toDate(t.tenggatWaktu),
  terlambat: t.status !== StatusPembayaran.SUCCESS && t.tenggatWaktu < startOfToday(),
  keterangan: t.keterangan,
  createdAt: t.createdAt,
  /** Konfirmasi manual yang menunggu verifikasi admin (ditandai metode pembayaran terisi). */
  menungguVerifikasi: t.pembayaran.some((p) => p.status === StatusPembayaran.PENDING && !!p.metodePembayaran),
  pembayaran: t.pembayaran.map((p) => ({
    id: p.id,
    metodePembayaran: p.metodePembayaran,
    nomorReferensi: p.transactionId,
    waktuTransaksi: p.waktuTransaksi,
    status: p.status,
    createdAt: p.createdAt,
  })),
});

/** UKT yang belum lunas dan sudah melewati tenggat memblokir pengisian KRS. */
export const uktTertunggak = (nim: string, db: Prisma.TransactionClient = prisma) =>
  db.tagihan.findFirst({
    where: {
      nim,
      jenisTagihan: JenisTagihan.UKT,
      status: { not: StatusPembayaran.SUCCESS },
      tenggatWaktu: { lt: startOfToday() },
    },
    select: { jumlah: true, tenggatWaktu: true },
  });

export class TagihanService {
  async listMahasiswa(nim: string): Promise<ApiResponse> {
    const rows = await prisma.tagihan.findMany({ where: { nim }, select: tagihanSelect, orderBy: { tenggatWaktu: 'desc' } });
    return ok(rows.map(toTagihanDto));
  }

  async listAll(filter: { status?: StatusPembayaran; nim?: string; menungguVerifikasi?: boolean }): Promise<ApiResponse> {
    const rows = await prisma.tagihan.findMany({
      where: {
        status: filter.status,
        nim: filter.nim,
        pembayaran: filter.menungguVerifikasi
          ? { some: { status: StatusPembayaran.PENDING, metodePembayaran: { not: null } } }
          : undefined,
      },
      select: tagihanSelect,
      orderBy: { createdAt: 'desc' },
    });
    return ok(rows.map(toTagihanDto));
  }

  async create(input: TagihanInput): Promise<ApiResponse> {
    const mhs = await prisma.mahasiswa.findUnique({ where: { nim: input.nim }, select: { nim: true } });
    if (!mhs) return fail('MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan');
    const row = await prisma.tagihan.create({
      data: {
        nim: input.nim,
        jenisTagihan: input.jenisTagihan,
        jumlah: input.jumlah,
        tenggatWaktu: new Date(`${input.tenggatWaktu}T00:00:00Z`),
        keterangan: input.keterangan || null,
      },
      select: tagihanSelect,
    });
    return ok(toTagihanDto(row), 'Tagihan dibuat');
  }

  async remove(id: string): Promise<ApiResponse> {
    const row = await prisma.tagihan.findUnique({ where: { id }, select: { status: true } });
    if (!row) return fail('NOT_FOUND', 'Tagihan tidak ditemukan');
    if (row.status === StatusPembayaran.SUCCESS) return fail('IN_USE', 'Tagihan yang sudah lunas tidak dapat dihapus');
    await prisma.tagihan.delete({ where: { id } });
    return ok(null, 'Tagihan dihapus');
  }

  /** Mahasiswa mengonfirmasi sudah membayar (transfer manual) → menunggu verifikasi admin. */
  async konfirmasi(id: string, nim: string, input: KonfirmasiInput): Promise<ApiResponse> {
    const t = await prisma.tagihan.findUnique({ where: { id }, select: tagihanSelect });
    if (!t || t.nim !== nim) return fail('NOT_FOUND', 'Tagihan tidak ditemukan');
    if (t.status === StatusPembayaran.SUCCESS) return fail('SUDAH_LUNAS', 'Tagihan sudah lunas');
    if (toTagihanDto(t).menungguVerifikasi) {
      return fail('KONFIRMASI_EXISTS', 'Konfirmasi sebelumnya masih menunggu verifikasi admin');
    }
    await prisma.pembayaran.create({
      data: {
        tagihanId: id,
        metodePembayaran: input.metodePembayaran,
        transactionId: input.nomorReferensi,
        waktuTransaksi: new Date(),
        status: StatusPembayaran.PENDING,
      },
    });
    return this.get(id, 'Konfirmasi pembayaran terkirim, menunggu verifikasi admin');
  }

  /** Admin menerima / menolak konfirmasi pembayaran yang menunggu. */
  async verifikasi(id: string, diterima: boolean): Promise<ApiResponse> {
    const t = await prisma.tagihan.findUnique({ where: { id }, select: tagihanSelect });
    if (!t) return fail('NOT_FOUND', 'Tagihan tidak ditemukan');
    const pending = t.pembayaran.find((p) => p.status === StatusPembayaran.PENDING && p.metodePembayaran);
    if (!pending) return fail('TIDAK_ADA_KONFIRMASI', 'Tidak ada konfirmasi pembayaran yang menunggu verifikasi');

    await prisma.$transaction([
      prisma.pembayaran.update({
        where: { id: pending.id },
        data: { status: diterima ? StatusPembayaran.SUCCESS : StatusPembayaran.FAILED },
      }),
      ...(diterima ? [prisma.tagihan.update({ where: { id }, data: { status: StatusPembayaran.SUCCESS } })] : []),
    ]);
    return this.get(id, diterima ? 'Pembayaran diverifikasi, tagihan lunas' : 'Konfirmasi pembayaran ditolak');
  }

  private async get(id: string, message: string): Promise<ApiResponse> {
    const row = await prisma.tagihan.findUnique({ where: { id }, select: tagihanSelect });
    return row ? ok(toTagihanDto(row), message) : fail('NOT_FOUND', 'Tagihan tidak ditemukan');
  }
}
