import { Router } from 'express';
import { TagihanController } from '../controllers/tagihan.controller';
import { authenticate, adminOnly, authorizeRole } from '@/middleware/auth.middleware';

const router = Router();
const tagihanController = new TagihanController();

router.use(authenticate);

// Create new Tagihan (Admin)
router.post('/', adminOnly, tagihanController.createTagihan);

// View all Tagihan (Admin)
router.get('/all', adminOnly, tagihanController.getAllTagihan);

// View my Tagihan (Mahasiswa: miliknya sendiri; Admin: ?nim=)
router.get('/me', authorizeRole(['MAHASISWA', 'ADMIN']), tagihanController.getMyTagihan);

export default router;
