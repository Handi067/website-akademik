/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { rootDir: '.', isolatedModules: true } }],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/utils/**/*.ts', 'src/services/**/*.ts', 'src/middleware/audit.middleware.ts'],
  coverageThreshold: {
    // Batas minimum untuk logika inti yang diuji tanpa database.
    './src/utils/grading.ts': { lines: 90 },
    './src/services/krs.service.ts': { lines: 60 },
    './src/services/perpustakaan.service.ts': { lines: 60 },
  },
};
