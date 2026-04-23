import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import appConfig from './config';
import { initConfigDatabase, closeConfigDatabase } from './config/database';
import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiAuthMiddleware } from './middleware/apiAuth';
import { closeAllDatabases } from './services/connections';

// Import routes
import connectionsRouter from './routes/connections';
import queryRouter from './routes/query';
import metadataRouter from './routes/metadata';
import importRouter from './routes/import';
import explainRouter from './routes/explain';
import autocompleteRouter from './routes/autocomplete';
import savedQueriesRouter from './routes/savedQueries';
import backupRouter from './routes/backup';
import learnRouter from './routes/learn';

let server: ReturnType<typeof express.prototype.listen> | null = null;

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    const isLoopbackHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return isHttp && isLoopbackHost;
  } catch {
    return false;
  }
}

function enforceDevRuntimeGuard(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const isElectronSpawned = process.env.RUN_UNDER_ELECTRON === '1';
  const expectedElectronNodeVersion = process.env.ELECTRON_NODE_VERSION;
  const expectedElectronAbi = process.env.ELECTRON_NODE_ABI;

  logger.info('Runtime startup details', {
    nodeVersion: process.version,
    abi: process.versions.modules,
    electron: process.versions.electron || 'none',
    runUnderElectron: isElectronSpawned,
    expectedElectronNodeVersion,
    expectedElectronAbi,
  });

  if (!isElectronSpawned) {
    logger.error('Blocked standalone dev server startup. Launch via Electron only.');
    console.error('❌ Standalone server dev runtime is blocked. Use npm run dev from workspace root.');
    process.exit(1);
  }

  if (expectedElectronNodeVersion && process.version !== expectedElectronNodeVersion) {
    logger.error('Blocked dev runtime due to Node version mismatch with Electron runtime', {
      currentNodeVersion: process.version,
      expectedElectronNodeVersion,
    });
    console.error(`❌ Runtime mismatch. Server node=${process.version}, Electron node=${expectedElectronNodeVersion}.`);
    process.exit(1);
  }

  if (expectedElectronAbi && process.versions.modules !== expectedElectronAbi) {
    logger.error('Blocked dev runtime due to ABI mismatch with Electron runtime', {
      nodeVersion: process.version,
      currentAbi: process.versions.modules,
      expectedElectronAbi,
    });
    console.error(`❌ ABI mismatch. Server ABI=${process.versions.modules}, Electron ABI=${expectedElectronAbi}.`);
    process.exit(1);
  }
}

export function createApp(): Application {
  const app = express();
  const isProduction = appConfig.nodeEnv === 'production';

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'", 'data:', "https://cdn.jsdelivr.net", "https://unpkg.com"],
              connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
              workerSrc: ["'self'", "blob:"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
              formAction: ["'self'"],
            },
          }
        : false,
    })
  );
  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin not allowed'));
    },
  }));

  // Response compression for faster data transfer
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balance between compression and CPU usage
  }));

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

  // API authentication (enabled when API_AUTH_TOKEN is provided by Electron runtime)
  app.use('/api/', apiAuthMiddleware);

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
  app.use('/api/autocomplete', autocompleteRouter);
  app.use('/api/saved-queries', savedQueriesRouter);
  app.use('/api/backup', backupRouter);
  app.use('/api/learn', learnRouter);

  // Serve static files in production (Electron app)
  if (appConfig.nodeEnv === 'production') {
    const resourcesPath = process.env.RESOURCES_PATH || path.join(__dirname, '../..');
    const clientPath = path.join(resourcesPath, 'client');
    logger.info(`Serving static files from: ${clientPath}`);
    
    app.use(express.static(clientPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  // Error handlers (only for API in production, all routes in dev)
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
        // Get the actual port (important when using port 0 for random port)
        const address = server!.address();
        const actualPort = typeof address === 'object' && address ? address.port : serverPort;
        
        logger.info(`Server started on http://${appConfig.server.host}:${actualPort}`);
        
        // Always log to console for electron to capture
        console.log(`Server started on http://${appConfig.server.host}:${actualPort}`);
        
        // Send port via IPC if forked
        if (process.send) {
          process.send({ type: 'server-ready', port: actualPort });
        }
        
        resolve(actualPort);
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

  // Close all database connections
  closeAllDatabases();

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

// Start server if run directly or forked
if (require.main === module || process.send) {
  enforceDevRuntimeGuard();

  // When forked, listen for IPC messages
  const portToUse = process.env.SERVER_PORT === '0' 
    ? 0  // Use random available port
    : parseInt(process.env.SERVER_PORT || '3000', 10);
    
  startServer(portToUse).catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}
