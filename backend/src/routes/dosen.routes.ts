import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, adminOnly } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { DosenService } from '@/services/dosen.service';
import { handle, paging } from '@/utils/http';

const router = Router();
const service = new DosenService();

const nidnParam = param('nidn').matches(/^[0-9]{8,20}$/).withMessage('NIDN harus 8–20 digit angka');

const profil = (optional: boolean) => {
  const f = (name: string) => (optional ? body(name).optional() : body(name));
  return [
    f('namaDosen').isString().trim().isLength({ min: 3, max: 100 }).withMessage('Nama dosen 3–100 karakter'),
    f('email').isEmail().withMessage('Email tidak valid').normalizeEmail(),
    body('gelarDepan').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('gelarBelakang').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
    body('noHp').optional({ values: 'falsy' }).matches(/^[+]?[0-9]{10,15}$/).withMessage('No. HP 10–15 digit'),
    body('departemen').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  ];
};

router.use(authenticate, adminOnly);

router.get('/', handle((req) => service.list({ search: req.query.search as string | undefined, ...paging(req.query) })));

router.get('/:nidn', [nidnParam], validateRequest, handle((req) => service.get(req.params.nidn)));

router.post(
  '/',
  [
    body('nidn').matches(/^[0-9]{8,20}$/).withMessage('NIDN harus 8–20 digit angka'),
    body('username').matches(/^[a-zA-Z0-9_]{3,50}$/).withMessage('Username 3–50 karakter: huruf, angka, atau _'),
    body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
    ...profil(false),
  ],
  validateRequest,
  handle(
    (req) =>
      service.create({
        nidn: req.body.nidn,
        username: req.body.username,
        password: req.body.password,
        namaDosen: req.body.namaDosen,
        email: req.body.email,
        gelarDepan: req.body.gelarDepan || undefined,
        gelarBelakang: req.body.gelarBelakang || undefined,
        noHp: req.body.noHp || undefined,
        departemen: req.body.departemen || undefined,
      }),
    201
  )
);

router.put(
  '/:nidn',
  [nidnParam, ...profil(true)],
  validateRequest,
  handle((req) =>
    service.update(req.params.nidn, {
      namaDosen: req.body.namaDosen,
      email: req.body.email,
      gelarDepan: req.body.gelarDepan,
      gelarBelakang: req.body.gelarBelakang,
      noHp: req.body.noHp,
      departemen: req.body.departemen,
    })
  )
);

router.delete('/:nidn', [nidnParam], validateRequest, handle((req) => service.remove(req.params.nidn)));

export default router;
