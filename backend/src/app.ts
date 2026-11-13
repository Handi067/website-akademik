import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from '@/config/app';
import { logger, stream } from '@/utils/logger';
import { connectDatabase } from '@/config/database';

// Import routes
import apiRoutes from '@/routes/index';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger
app.use(morgan('combined', { stream }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// API routes
app.use('/api', apiRoutes);

// API documentation (if enabled)
// Dokumentasi API: satu sumber kebenaran di postman/specs (juga dipakai Postman)
if (config.swaggerEnabled) {
  const specPath =
    process.env.OPENAPI_SPEC_PATH || path.resolve(__dirname, '../../postman/specs/website-akademik-api.yaml');
  try {
    const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));
    app.get('/api-docs.json', (_req, res) => res.json(spec));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Website Akademik API' }));
    logger.info('Swagger documentation available at /api-docs');
  } catch (error) {
    logger.warn(`OpenAPI spec tidak dapat dimuat dari ${specPath}; /api-docs dinonaktifkan`, error);
  }
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: 'ROUTE_NOT_FOUND'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      data: { details: err.message }
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
      error: 'UNAUTHORIZED'
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large',
      error: 'FILE_TOO_LARGE'
    });
  }

  // Default error response
  return res.status(err.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    error: 'INTERNAL_ERROR',
    ...(config.nodeEnv !== 'production' && { stack: err.stack })
  });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      
      if (config.swaggerEnabled) {
        logger.info(`API Documentation: http://localhost:${config.port}/api-docs`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
