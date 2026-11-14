// Nilai tetap agar test tidak bergantung pada backend/.env dan tidak pernah menyentuh database sungguhan.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_unused';
process.env.JWT_SECRET = 'test-secret';
process.env.SEMESTER_AKTIF = 'Ganjil';
process.env.TAHUN_AJARAN_AKTIF = '2025/2026';
process.env.MAX_SKS = '24';
process.env.PERPUS_LAMA_PINJAM_HARI = '7';
process.env.PERPUS_DENDA_PER_HARI = '1000';
process.env.PERPUS_MAX_PINJAM = '3';
process.env.LOG_LEVEL = 'error';
