/**
 * Mock Prisma sederhana: setiap model berisi jest.fn() untuk method yang dipakai service.
 * `$transaction(fn)` menjalankan callback dengan klien yang sama (tx === prisma),
 * `$transaction([...])` menunggu semua promise.
 */
const methods = ['findUnique', 'findFirst', 'findMany', 'count', 'create', 'update', 'updateMany', 'upsert', 'delete', 'createMany'];
const models = ['jadwalKuliah', 'krs', 'nilai', 'tagihan', 'mahasiswa', 'buku', 'peminjaman', 'pembayaran', 'notifikasi', 'user', 'auditLog'];

export type ModelMock = Record<string, jest.Mock>;
export type PrismaMock = Record<string, ModelMock> & { $transaction: jest.Mock };

export const createPrismaMock = (): PrismaMock => {
  const p: any = {};
  for (const m of models) p[m] = Object.fromEntries(methods.map((fn) => [fn, jest.fn()]));
  p.$transaction = jest.fn((arg: unknown) => (typeof arg === 'function' ? arg(p) : Promise.all(arg as Promise<unknown>[])));
  return p;
};

export const prismaMock = createPrismaMock();

export const resetPrismaMock = () => {
  for (const m of models) for (const fn of methods) prismaMock[m][fn].mockReset();
};

/** Baris jadwal dengan bentuk `jadwalSelect` (+ kodePrasyarat untuk KRS). */
export const jadwalRow = (o: Partial<{
  id: string;
  kodeMk: string;
  namaMk: string;
  sks: number;
  hari: string;
  mulai: string;
  selesai: string;
  semester: string;
  tahunAjaran: string;
  kapasitas: number;
  terisi: number;
  prasyarat: string | null;
}> = {}) => ({
  id: o.id ?? 'j-1',
  hari: o.hari ?? 'SENIN',
  jamMulai: new Date(`1970-01-01T${o.mulai ?? '08:00'}:00.000Z`),
  jamSelesai: new Date(`1970-01-01T${o.selesai ?? '10:00'}:00.000Z`),
  ruangan: 'R1',
  kelas: 'A',
  semester: o.semester ?? 'Ganjil',
  tahunAjaran: o.tahunAjaran ?? '2025/2026',
  kapasitas: o.kapasitas ?? 30,
  matakuliah: { kodeMK: o.kodeMk ?? 'IF101', namaMk: o.namaMk ?? 'Pemrograman', sks: o.sks ?? 3, kodePrasyarat: o.prasyarat ?? null },
  dosen: { nidn: '1234567890', namaDosen: 'Dosen' },
  _count: { krs: o.terisi ?? 0 },
});
