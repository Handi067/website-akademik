import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  databaseUrl: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  upload: {
    maxFileSize: number;
    uploadPath: string;
  };
  logging: {
    level: string;
    file: string;
  };
  bcryptRounds: number;
  sessionSecret: string;
  swaggerEnabled: boolean;
  healthCheckInterval: number;
  periodeAktif: {
    semester: string;
    tahunAjaran: string;
  };
  maxSks: number;
  perpustakaan: { lamaPinjamHari: number; dendaPerHari: number; maxPinjam: number };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:061202@localhost:5432/db_akademik',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@academic-system.com',
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret-change-in-production',
  swaggerEnabled: process.env.SWAGGER_ENABLED?.trim() === 'true',
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  periodeAktif: {
    semester: process.env.SEMESTER_AKTIF || 'Ganjil',
    tahunAjaran: process.env.TAHUN_AJARAN_AKTIF || '2025/2026',
  },
  maxSks: parseInt(process.env.MAX_SKS || '24', 10),
  perpustakaan: {
    lamaPinjamHari: parseInt(process.env.PERPUS_LAMA_PINJAM_HARI || '7', 10),
    dendaPerHari: parseInt(process.env.PERPUS_DENDA_PER_HARI || '1000', 10),
    maxPinjam: parseInt(process.env.PERPUS_MAX_PINJAM || '3', 10),
  },
};

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

if (config.nodeEnv === 'production') {
  requiredEnvVars.push('JWT_REFRESH_SECRET', 'SESSION_SECRET');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export default config;
