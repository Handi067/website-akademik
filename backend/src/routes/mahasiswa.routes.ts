import { Router } from 'express';
import { MahasiswaController } from '@/controllers/mahasiswa.controller';
import { authenticate, adminOnly } from '@/middleware/auth.middleware';
import { body, param, query } from 'express-validator';
import { validateRequest } from '@/middleware/validation.middleware';

const router = Router();
const mahasiswaController = new MahasiswaController();

// Validation rules
const createMahasiswaValidation = [
  body('nim')
    .isLength({ min: 8, max: 20 })
    .withMessage('NIM must be between 8 and 20 characters')
    .matches(/^[0-9]+$/)
    .withMessage('NIM must contain only numbers'),
  
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username 3–50 karakter: huruf, angka, atau _'),

  body('email')
    .isEmail()
    .withMessage('Email tidak valid')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minimal 8 karakter'),
  
  body('namaMhs')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage('Name can only contain letters, spaces, and special characters'),
  
  body('jurusan')
    .isLength({ min: 3, max: 50 })
    .withMessage('Jurusan must be between 3 and 50 characters'),
  
  body('angkatan')
    .isLength({ min: 4, max: 10 })
    .withMessage('Angkatan must be between 4 and 10 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Angkatan must contain only numbers'),
  
  body('noHp')
    .optional()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters')
    .matches(/^[+]?[0-9]+$/)
    .withMessage('Phone number can only contain numbers and optional +'),
  
  body('alamat')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
];

const updateMahasiswaValidation = [
  body('namaMhs')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage('Name can only contain letters, spaces, and special characters'),
  
  body('jurusan')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Jurusan must be between 3 and 50 characters'),
  
  body('angkatan')
    .optional()
    .isLength({ min: 4, max: 10 })
    .withMessage('Angkatan must be between 4 and 10 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Angkatan must contain only numbers'),
  
  body('noHp')
    .optional()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters')
    .matches(/^[+]?[0-9]+$/)
    .withMessage('Phone number can only contain numbers and optional +'),
  
  body('alamat')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
];

const nimValidation = [
  param('nim')
    .isLength({ min: 8, max: 20 })
    .withMessage('NIM must be between 8 and 20 characters')
    .matches(/^[0-9]+$/)
    .withMessage('NIM must contain only numbers')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Search term must not exceed 100 characters'),
  
  query('sortBy')
    .optional()
    .isIn(['nim', 'namaMhs', 'jurusan', 'angkatan', 'createdAt'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  query('jurusan')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Jurusan filter must not exceed 50 characters'),
  
  query('angkatan')
    .optional()
    .isLength({ min: 4, max: 10 })
    .withMessage('Angkatan filter must be between 4 and 10 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Angkatan filter must contain only numbers')
];

// Routes
router.post(
  '/',
  authenticate,
  adminOnly,
  createMahasiswaValidation,
  validateRequest,
  mahasiswaController.createMahasiswa
);

router.get(
  '/',
  authenticate,
  adminOnly,
  paginationValidation,
  validateRequest,
  mahasiswaController.getMahasiswaList
);

router.get(
  '/stats',
  authenticate,
  adminOnly,
  mahasiswaController.getMahasiswaStats
);

router.get(
  '/:nim',
  authenticate,
  adminOnly,
  nimValidation,
  validateRequest,
  mahasiswaController.getMahasiswaByNim
);

router.put(
  '/:nim',
  authenticate,
  adminOnly,
  nimValidation,
  updateMahasiswaValidation,
  validateRequest,
  mahasiswaController.updateMahasiswa
);

router.delete(
  '/:nim',
  authenticate,
  adminOnly,
  nimValidation,
  validateRequest,
  mahasiswaController.deleteMahasiswa
);

export default router;
