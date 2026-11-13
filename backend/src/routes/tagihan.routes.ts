import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { JenisTagihan, StatusPembayaran } from '@prisma/client';
import { authenticate, adminOnly, authorizeRole } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { TagihanService } from '@/services/tagihan.service';
import { handle } from '@/utils/http';
import { isError, targetNim } from '@/utils/actor';

const router = Router();
const service = new TagihanService();

const JENIS = Object.values(JenisTagihan);
const STATUS = Object.values(StatusPembayaran);
const idParam = param('id').isUUID().withMessage('ID tagihan tidak valid');

router.use(authenticate);

// Admin: semua tagihan (filter ?status=, ?nim=, ?menungguVerifikasi=true)
router.get(
  '/all',
  adminOnly,
  [query('status').optional().isIn(STATUS), query('menungguVerifikasi').optional().isBoolean()],
  validateRequest,
  handle((req) =>
    service.listAll({
      status: req.query.status as StatusPembayaran | undefined,
      nim: (req.query.nim as string) || undefined,
      menungguVerifikasi: req.query.menungguVerifikasi === 'true',
    })
  )
);

// Mahasiswa: miliknya sendiri; admin: ?nim=
router.get(
  '/me',
  authorizeRole(['MAHASISWA', 'ADMIN']),
  handle(async (req) => {
    const t = await targetNim(req);
    return isError(t) ? t : service.listMahasiswa(t.nim);
  })
);

router.post(
  '/',
  adminOnly,
  [
    body('nim').isString().trim().notEmpty().withMessage('NIM wajib diisi'),
    body('jenisTagihan').isIn(JENIS).withMessage(`Jenis tagihan harus salah satu dari ${JENIS.join(', ')}`),
    body('jumlah').isFloat({ min: 1, max: 999_999_999 }).withMessage('Jumlah harus lebih dari 0').toFloat(),
    body('tenggatWaktu').isISO8601({ strict: true }).withMessage('Tenggat waktu format YYYY-MM-DD'),
    body('keterangan').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  ],
  validateRequest,
  handle(
    (req) =>
      service.create({
        nim: req.body.nim,
        jenisTagihan: req.body.jenisTagihan,
        jumlah: req.body.jumlah,
        tenggatWaktu: String(req.body.tenggatWaktu).slice(0, 10),
        keterangan: req.body.keterangan,
      }),
    201
  )
);

router.delete('/:id', adminOnly, [idParam], validateRequest, handle((req) => service.remove(req.params.id)));

// Mahasiswa: konfirmasi pembayaran manual (transfer bank)
router.post(
  '/:id/konfirmasi',
  authorizeRole(['MAHASISWA']),
  [
    idParam,
    body('metodePembayaran').isString().trim().isLength({ min: 2, max: 50 }).withMessage('Metode pembayaran 2–50 karakter'),
    body('nomorReferensi').isString().trim().isLength({ min: 3, max: 100 }).withMessage('Nomor referensi 3–100 karakter'),
  ],
  validateRequest,
  handle(async (req) => {
    const t = await targetNim(req);
    if (isError(t)) return t;
    return service.konfirmasi(req.params.id, t.nim, {
      metodePembayaran: req.body.metodePembayaran,
      nomorReferensi: req.body.nomorReferensi,
    });
  })
);

// Admin: terima / tolak konfirmasi
router.put(
  '/:id/verifikasi',
  adminOnly,
  [idParam, body('diterima').isBoolean().withMessage('diterima harus true/false').toBoolean()],
  validateRequest,
  handle((req) => service.verifikasi(req.params.id, req.body.diterima))
);

export default router;
