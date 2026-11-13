import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorizeRole } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { NilaiService } from '@/services/nilai.service';
import { handle } from '@/utils/http';
import { isError, targetNim } from '@/utils/actor';

const router = Router();
const service = new NilaiService();

const jadwalParam = param('jadwalId').isUUID().withMessage('ID jadwal tidak valid');
const komponen = (name: string) =>
  body(`nilai.*.${name}`)
    .optional({ values: 'null' })
    .isFloat({ min: 0, max: 100 })
    .withMessage(`Nilai ${name} harus 0–100`)
    .toFloat();

router.use(authenticate);

// Dosen pengampu / admin: peserta & nilai satu kelas
router.get(
  '/kelas/:jadwalId',
  authorizeRole(['DOSEN', 'ADMIN']),
  [jadwalParam],
  validateRequest,
  handle((req) => service.getKelas(req.params.jadwalId, req.user!))
);

router.put(
  '/kelas/:jadwalId',
  authorizeRole(['DOSEN', 'ADMIN']),
  [
    jadwalParam,
    body('nilai').isArray({ min: 1, max: 500 }).withMessage('nilai harus berupa array'),
    body('nilai.*.nim').isString().notEmpty().withMessage('NIM wajib diisi'),
    komponen('tugas'),
    komponen('uts'),
    komponen('uas'),
  ],
  validateRequest,
  handle((req) =>
    service.simpanKelas(
      req.params.jadwalId,
      req.user!,
      (req.body.nilai as any[]).map((n) => ({
        nim: String(n.nim),
        tugas: n.tugas ?? null,
        uts: n.uts ?? null,
        uas: n.uas ?? null,
      }))
    )
  )
);

// Mahasiswa: miliknya; admin: ?nim=
router.get(
  '/khs',
  authorizeRole(['MAHASISWA', 'ADMIN']),
  handle(async (req) => {
    const t = await targetNim(req);
    if (isError(t)) return t;
    return service.getKhs(t.nim, {
      semester: req.query.semester as string | undefined,
      tahunAjaran: req.query.tahunAjaran as string | undefined,
    });
  })
);

router.get(
  '/transkrip',
  authorizeRole(['MAHASISWA', 'ADMIN']),
  handle(async (req) => {
    const t = await targetNim(req);
    return isError(t) ? t : service.getTranskrip(t.nim);
  })
);

export default router;
