import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorizeRole } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { KrsService } from '@/services/krs.service';
import { handle } from '@/utils/http';
import { isError, targetNim } from '@/utils/actor';

const router = Router();
const service = new KrsService();

router.use(authenticate);

/** GET /krs?semester=&tahunAjaran= — mahasiswa: miliknya; admin: wajib ?nim= */
router.get(
  '/',
  authorizeRole(['MAHASISWA', 'ADMIN']),
  handle(async (req) => {
    const t = await targetNim(req);
    if (isError(t)) return t;
    const { semester, tahunAjaran } = req.query;
    return service.getKrs(
      t.nim,
      typeof semester === 'string' && typeof tahunAjaran === 'string' ? { semester, tahunAjaran } : undefined
    );
  })
);

// Pengisian KRS hanya oleh mahasiswa yang bersangkutan.
router.get(
  '/penawaran',
  authorizeRole(['MAHASISWA']),
  handle(async (req) => {
    const t = await targetNim(req);
    return isError(t) ? t : service.getPenawaran(t.nim);
  })
);

router.post(
  '/',
  authorizeRole(['MAHASISWA']),
  [body('jadwalId').isUUID().withMessage('jadwalId tidak valid')],
  validateRequest,
  handle(async (req) => {
    const t = await targetNim(req);
    return isError(t) ? t : service.add(t.nim, req.body.jadwalId);
  }, 201)
);

router.delete(
  '/:id',
  authorizeRole(['MAHASISWA']),
  [param('id').isUUID().withMessage('ID KRS tidak valid')],
  validateRequest,
  handle(async (req) => {
    const t = await targetNim(req);
    return isError(t) ? t : service.remove(t.nim, req.params.id);
  })
);

export default router;
