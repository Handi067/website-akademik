import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate, adminOnly } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { NotifikasiService } from '@/services/notifikasi.service';
import { AuditService } from '@/services/audit.service';
import { handle } from '@/utils/http';

const router = Router();
const service = new NotifikasiService();
const audit = new AuditService();

router.use(authenticate);

router.get('/', handle((req) => service.list(req.user!.id, req.query)));
router.put('/baca-semua', handle((req) => service.markAllRead(req.user!.id)));
router.put(
  '/:id/baca',
  [param('id').isUUID().withMessage('ID notifikasi tidak valid')],
  validateRequest,
  handle((req) => service.markRead(req.user!.id, req.params.id))
);

/** Audit log: khusus admin, filter ?tabel= dan ?username=. */
export const auditRouter = Router();
auditRouter.get('/', authenticate, adminOnly, handle((req) => audit.list(req.query)));

export default router;
