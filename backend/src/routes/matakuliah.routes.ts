import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, adminOnly } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { MatakuliahService } from '@/services/matakuliah.service';
import { handle } from '@/utils/http';

const router = Router();
const service = new MatakuliahService();

const KODE = /^[A-Za-z0-9]{2,10}$/;
const kodeParam = param('kodeMk').matches(KODE).withMessage('Kode MK 2–10 huruf/angka').toUpperCase();

const fields = (optional: boolean) => {
  const f = (name: string) => (optional ? body(name).optional() : body(name));
  return [
    f('namaMk').isString().trim().isLength({ min: 3, max: 100 }).withMessage('Nama MK 3–100 karakter'),
    f('sks').isInt({ min: 1, max: 6 }).withMessage('SKS 1–6').toInt(),
    f('semester').isInt({ min: 1, max: 14 }).withMessage('Semester 1–14').customSanitizer((v) => String(v)),
    body('deskripsi').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
    body('kodePrasyarat').optional({ values: 'falsy' }).matches(KODE).withMessage('Kode prasyarat tidak valid'),
  ];
};

router.use(authenticate);

router.get('/', handle((req) => service.list(req.query.search as string | undefined)));
router.get('/:kodeMk', [kodeParam], validateRequest, handle((req) => service.get(req.params.kodeMk)));

router.post(
  '/',
  adminOnly,
  [body('kodeMk').matches(KODE).withMessage('Kode MK 2–10 huruf/angka'), ...fields(false)],
  validateRequest,
  handle((req) => service.create(req.body), 201)
);

router.put(
  '/:kodeMk',
  adminOnly,
  [kodeParam, ...fields(true)],
  validateRequest,
  handle((req) =>
    service.update(req.params.kodeMk, {
      namaMk: req.body.namaMk,
      sks: req.body.sks,
      semester: req.body.semester,
      deskripsi: req.body.deskripsi,
      kodePrasyarat: req.body.kodePrasyarat,
    })
  )
);

router.delete('/:kodeMk', adminOnly, [kodeParam], validateRequest, handle((req) => service.remove(req.params.kodeMk)));

export default router;
