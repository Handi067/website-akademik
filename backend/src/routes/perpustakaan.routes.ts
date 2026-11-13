import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, adminOnly, authorizeRole } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { PerpustakaanService } from '@/services/perpustakaan.service';
import { handle, paging } from '@/utils/http';
import { isError, targetNim } from '@/utils/actor';

const router = Router();
const service = new PerpustakaanService();

const KODE = /^[A-Za-z0-9-]{2,20}$/;
const kodeParam = param('kodeBuku').matches(KODE).withMessage('Kode buku tidak valid').toUpperCase();
const tahunMax = new Date().getFullYear() + 1;

const bukuFields = [
  body('judul').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Judul 1–200 karakter'),
  body('pengarang').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Pengarang 1–100 karakter'),
  body('penerbit').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Penerbit 1–100 karakter'),
  body('tahun').isInt({ min: 1000, max: tahunMax }).withMessage(`Tahun 1000–${tahunMax}`).toInt(),
  body('isbn').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('kategori').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Kategori 1–50 karakter'),
  body('jumlah').isInt({ min: 1, max: 1000 }).withMessage('Jumlah eksemplar 1–1000').toInt(),
];

const pickBuku = (b: any) => ({
  judul: b.judul,
  pengarang: b.pengarang,
  penerbit: b.penerbit,
  tahun: b.tahun,
  isbn: b.isbn,
  kategori: b.kategori,
  jumlah: b.jumlah,
});

router.use(authenticate);

// Katalog: semua pengguna
router.get('/buku', handle((req) =>
  service.listBuku({
    search: (req.query.search as string) || undefined,
    kategori: (req.query.kategori as string) || undefined,
    ...paging(req.query),
  })
));

router.post(
  '/buku',
  adminOnly,
  [body('kodeBuku').matches(KODE).withMessage('Kode buku 2–20 huruf/angka/-').toUpperCase(), ...bukuFields],
  validateRequest,
  handle((req) => service.createBuku({ kodeBuku: req.body.kodeBuku, ...pickBuku(req.body) }), 201)
);
router.put('/buku/:kodeBuku', adminOnly, [kodeParam, ...bukuFields], validateRequest, handle((req) => service.updateBuku(req.params.kodeBuku, pickBuku(req.body))));
router.delete('/buku/:kodeBuku', adminOnly, [kodeParam], validateRequest, handle((req) => service.removeBuku(req.params.kodeBuku)));

// Riwayat peminjaman: mahasiswa miliknya; admin semua (opsional ?nim=, ?aktif=true)
router.get(
  '/peminjaman',
  authorizeRole(['MAHASISWA', 'ADMIN']),
  [query('aktif').optional().isBoolean()],
  validateRequest,
  handle(async (req) => {
    const aktif = req.query.aktif === 'true';
    if (req.user!.role === 'ADMIN') return service.listPeminjaman({ nim: (req.query.nim as string) || undefined, aktif });
    const t = await targetNim(req);
    return isError(t) ? t : service.listPeminjaman({ nim: t.nim, aktif });
  })
);

// Petugas (admin) mencatat pinjam & kembali
router.post(
  '/peminjaman',
  adminOnly,
  [
    body('nim').isString().trim().notEmpty().withMessage('NIM wajib diisi'),
    body('kodeBuku').matches(KODE).withMessage('Kode buku tidak valid').toUpperCase(),
  ],
  validateRequest,
  handle((req) => service.pinjam(req.body.nim, req.body.kodeBuku), 201)
);
router.put(
  '/peminjaman/:id/kembali',
  adminOnly,
  [param('id').isUUID().withMessage('ID peminjaman tidak valid')],
  validateRequest,
  handle((req) => service.kembalikan(req.params.id))
);

export default router;
