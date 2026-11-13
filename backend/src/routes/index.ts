import { Router } from 'express';
import config from '@/config/app';
import { authenticate } from '@/middleware/auth.middleware';
import { DashboardService } from '@/services/dashboard.service';
import { handle, ok } from '@/utils/http';
import authRoutes from './auth.routes';
import mahasiswaRoutes from './mahasiswa.routes';
import dosenRoutes from './dosen.routes';
import matakuliahRoutes from './matakuliah.routes';
import jadwalRoutes from './jadwal.routes';
import krsRoutes from './krs.routes';
import nilaiRoutes from './nilai.routes';
import tagihanRoutes from './tagihan.routes';
import paymentRoutes from './payment.routes';
import absensiRoutes from './absensi.routes';
import perpustakaanRoutes from './perpustakaan.routes';

const router = Router();
const dashboard = new DashboardService();

// API version
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Academic Information System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Route modules
router.use('/auth', authRoutes);
router.use('/mahasiswa', mahasiswaRoutes);
router.use('/dosen', dosenRoutes);
router.use('/matakuliah', matakuliahRoutes);
router.use('/jadwal', jadwalRoutes);
router.use('/krs', krsRoutes);
router.use('/nilai', nilaiRoutes);
router.use('/tagihan', tagihanRoutes);
router.use('/payment', paymentRoutes);
router.use('/absensi', absensiRoutes);
router.use('/perpustakaan', perpustakaanRoutes);

router.get('/periode', authenticate, (req, res) => {
  res.json(ok({ ...config.periodeAktif, maxSks: config.maxSks }));
});
router.get('/dashboard', authenticate, handle((req) => dashboard.forUser(req.user!)));

export default router;
