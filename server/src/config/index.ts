import { config } from 'dotenv';
import path from 'path';

config();

interface Config {
  nodeEnv: string;
  server: {
    port: number;
    host: string;
  };
  query: {
    timeoutMs: number;
    maxResultRows: number;
    batchInsertSize: number;
  };
  logging: {
    level: string;
    file: string;
  };
  database: {
    configDbPath: string;
  };
  csv: {
    maxSizeMB: number;
    sampleRows: number;
  };
}

const appConfig: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000', 10),
    host: process.env.SERVER_HOST || 'localhost',
  },
  query: {
    timeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || '60000', 10), // Increased to 60s for complex queries
    maxResultRows: parseInt(process.env.MAX_RESULT_ROWS || '50000', 10), // Increased to 50k for better UX
    batchInsertSize: parseInt(process.env.BATCH_INSERT_SIZE || '5000', 10), // Increased to 5k for faster imports
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'app.log'),
  },
  database: {
    configDbPath: process.env.CONFIG_DB_PATH || path.join(process.cwd(), 'config', 'connections.db'),
  },
  csv: {
    maxSizeMB: parseInt(process.env.MAX_CSV_SIZE_MB || '100', 10),
    sampleRows: parseInt(process.env.CSV_SAMPLE_ROWS || '100', 10),
  },
};

export default appConfig;
