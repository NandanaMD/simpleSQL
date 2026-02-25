import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import appConfig from './config';
import { initConfigDatabase, closeConfigDatabase } from './config/database';
import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { closeAllPools } from './services/connections';

// Import routes
import connectionsRouter from './routes/connections';
import queryRouter from './routes/query';
import metadataRouter from './routes/metadata';
import importRouter from './routes/import';
import explainRouter from './routes/explain';

let server: ReturnType<typeof express.prototype.listen> | null = null;

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(cors());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Body parsing - exclude file upload routes from body parser
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api/import')) {
      // Skip body parsing for import routes (handled by multer)
      return next();
    }
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging
  app.use(requestLogger);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: appConfig.nodeEnv,
    });
  });

  // API routes
  app.use('/api/connections', connectionsRouter);
  app.use('/api/query', queryRouter);
  app.use('/api/metadata', metadataRouter);
  app.use('/api/import', importRouter);
  app.use('/api/explain', explainRouter);

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startServer(port?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      // Initialize config database
      initConfigDatabase();

      const app = createApp();
      const serverPort = port || appConfig.server.port;

      server = app.listen(serverPort, appConfig.server.host, () => {
        logger.info(`Server started on http://${appConfig.server.host}:${serverPort}`);
        resolve(serverPort);
      });

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${serverPort} is already in use`);
        }
        reject(error);
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      reject(error);
    }
  });
}

export async function stopServer(): Promise<void> {
  logger.info('Shutting down server...');

  // Close all database pools
  await closeAllPools();

  // Close config database
  closeConfigDatabase();

  // Close HTTP server
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        logger.info('Server stopped');
        resolve();
      });
    });
    server = null;
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await stopServer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received');
  await stopServer();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  stopServer()
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

// Start server if run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}
