import { Router } from 'express';
import { body, param } from 'express-validator';
import { StatusHadir } from '@prisma/client';
import { authenticate, authorizeRole } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { AbsensiService } from '@/services/absensi.service';
import { handle } from '@/utils/http';
import { isError, targetNim } from '@/utils/actor';

const router = Router();
const service = new AbsensiService();

const STATUS = Object.values(StatusHadir);
const jadwalParam = param('jadwalId').isUUID().withMessage('ID jadwal tidak valid');
const idParam = param('id').isUUID().withMessage('ID pertemuan tidak valid');
const pengajar = authorizeRole(['DOSEN', 'ADMIN']);

router.use(authenticate);

// Mahasiswa: rekap miliknya; admin: ?nim=
router.get(
  '/saya',
  authorizeRole(['MAHASISWA', 'ADMIN']),
  handle(async (req) => {
    const t = await targetNim(req);
    if (isError(t)) return t;
    return service.getRekapMahasiswa(t.nim, {
      semester: req.query.semester as string | undefined,
      tahunAjaran: req.query.tahunAjaran as string | undefined,
    });
  })
);

// Dosen pengampu / admin
router.get('/kelas/:jadwalId', pengajar, [jadwalParam], validateRequest, handle((req) => service.getKelas(req.params.jadwalId, req.user!)));

router.post(
  '/kelas/:jadwalId/pertemuan',
  pengajar,
  [
    jadwalParam,
    body('tanggal').isISO8601({ strict: true }).withMessage('Tanggal format YYYY-MM-DD'),
    body('topik').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }).withMessage('Topik maks. 200 karakter'),
    body('materi').optional({ values: 'falsy' }).isString(),
  ],
  validateRequest,
  handle(
    (req) =>
      service.createPertemuan(req.params.jadwalId, req.user!, {
        tanggal: String(req.body.tanggal).slice(0, 10),
        topik: req.body.topik,
        materi: req.body.materi,
      }),
    201
  )
);

router.get('/pertemuan/:id', pengajar, [idParam], validateRequest, handle((req) => service.getPertemuan(req.params.id, req.user!)));

router.put(
  '/pertemuan/:id',
  pengajar,
  [
    idParam,
    body('absensi').isArray({ min: 1, max: 500 }).withMessage('absensi harus berupa array'),
    body('absensi.*.nim').isString().notEmpty().withMessage('NIM wajib diisi'),
    body('absensi.*.statusHadir').isIn(STATUS).withMessage(`Status harus salah satu dari ${STATUS.join(', ')}`),
    body('absensi.*.keterangan').optional({ values: 'null' }).isString().isLength({ max: 500 }),
  ],
  validateRequest,
  handle((req) =>
    service.simpanAbsensi(
      req.params.id,
      req.user!,
      (req.body.absensi as any[]).map((a) => ({
        nim: String(a.nim),
        statusHadir: a.statusHadir as StatusHadir,
        keterangan: a.keterangan ?? null,
      }))
    )
  )
);

router.delete('/pertemuan/:id', pengajar, [idParam], validateRequest, handle((req) => service.removePertemuan(req.params.id, req.user!)));

export default router;
