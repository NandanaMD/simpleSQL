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
    timeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10),
    maxResultRows: parseInt(process.env.MAX_RESULT_ROWS || '10000', 10),
    batchInsertSize: parseInt(process.env.BATCH_INSERT_SIZE || '1000', 10),
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
