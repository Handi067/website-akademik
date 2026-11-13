import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { Hari } from '@prisma/client';
import { authenticate, adminOnly } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { JadwalService } from '@/services/jadwal.service';
import { handle } from '@/utils/http';
import { TIME_PATTERN } from '@/utils/time';

const router = Router();
const service = new JadwalService();

const HARI = Object.values(Hari);
const idParam = param('id').isUUID().withMessage('ID jadwal tidak valid');

const fields = [
  body('kodeMk').isString().trim().notEmpty().withMessage('Mata kuliah wajib dipilih').toUpperCase(),
  body('nidn').isString().trim().notEmpty().withMessage('Dosen wajib dipilih'),
  body('hari').isIn(HARI).withMessage(`Hari harus salah satu dari ${HARI.join(', ')}`),
  body('jamMulai').matches(TIME_PATTERN).withMessage('Jam mulai format HH:MM'),
  body('jamSelesai').matches(TIME_PATTERN).withMessage('Jam selesai format HH:MM'),
  body('ruangan').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Ruangan 1–20 karakter'),
  body('kelas').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('semester').isIn(['Ganjil', 'Genap']).withMessage('Semester harus Ganjil atau Genap'),
  body('tahunAjaran').matches(/^\d{4}\/\d{4}$/).withMessage('Tahun ajaran format YYYY/YYYY'),
  body('kapasitas').isInt({ min: 1, max: 500 }).withMessage('Kapasitas 1–500').toInt(),
];

const pick = (b: any) => ({
  kodeMk: b.kodeMk,
  nidn: b.nidn,
  hari: b.hari,
  jamMulai: b.jamMulai,
  jamSelesai: b.jamSelesai,
  ruangan: b.ruangan,
  kelas: b.kelas,
  semester: b.semester,
  tahunAjaran: b.tahunAjaran,
  kapasitas: b.kapasitas,
});

router.use(authenticate);

router.get(
  '/',
  [query('hari').optional().isIn(HARI), query('semester').optional().isString(), query('tahunAjaran').optional().isString()],
  validateRequest,
  handle((req) =>
    service.list({
      semester: req.query.semester as string | undefined,
      tahunAjaran: req.query.tahunAjaran as string | undefined,
      nidn: req.query.nidn as string | undefined,
      kodeMk: req.query.kodeMk as string | undefined,
      hari: req.query.hari as Hari | undefined,
    })
  )
);
router.get('/:id', [idParam], validateRequest, handle((req) => service.get(req.params.id)));
router.post('/', adminOnly, fields, validateRequest, handle((req) => service.create(pick(req.body)), 201));
router.put('/:id', adminOnly, [idParam, ...fields], validateRequest, handle((req) => service.update(req.params.id, pick(req.body))));
router.delete('/:id', adminOnly, [idParam], validateRequest, handle((req) => service.remove(req.params.id)));

export default router;
