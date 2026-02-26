import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import { fork, ChildProcess } from 'child_process';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort: number = 3000;

// Log file for debugging production issues
const logPath = isDev 
  ? path.join(__dirname, '../../electron/logs/electron.log') 
  : path.join(app.getPath('userData'), 'logs', 'electron.log');

function logToFile(message: string) {
  try {
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    console.log(message);
  } catch (error) {
    console.error('Failed to write to log:', error);
  }
}

function assertRuntimeLock(): void {
  const nodeVersion = process.version;
  const nodeAbi = process.versions.modules;
  const electronVersion = process.versions.electron || 'unknown';

  logToFile(`[Runtime] Node=${nodeVersion} ABI=${nodeAbi} Electron=${electronVersion}`);

  try {
    require('better-sqlite3');
    logToFile('[Runtime] better-sqlite3 preload success');
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    logToFile(`[Runtime] better-sqlite3 preload failed: ${details}`);
    throw error;
  }
}

async function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const serverPath = isDev
      ? path.join(__dirname, '../../server/src/index.ts')
      : path.join(process.resourcesPath, 'server', 'index.js');

    logToFile(`Starting server from: ${serverPath}`);
    logToFile(`Server path exists: ${fs.existsSync(serverPath)}`);
    logToFile(`isDev: ${isDev}`);
    logToFile(`process.resourcesPath: ${process.resourcesPath}`);

    const execArgv = isDev ? ['-r', 'tsx/cjs'] : [];
    const serverDir = isDev 
      ? path.join(__dirname, '../../server')
      : path.join(process.resourcesPath, 'server');

    logToFile(`Server working directory: ${serverDir}`);

    // Use fork in both dev and production
    // In production, set NODE_PATH to help Electron's Node.js find modules in extraResources
    const nodeModulesPath = path.join(serverDir, 'node_modules');
    
    // Force use of Electron's Node.js by specifying execPath
    serverProcess = fork(serverPath, [], {
      execPath: process.execPath, // Use Electron's Node.js, not system Node.js
      execArgv,
      cwd: serverDir,
      env: {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        SERVER_PORT: '0',
        RESOURCES_PATH: process.resourcesPath,
        RUN_UNDER_ELECTRON: '1',
        ELECTRON_NODE_VERSION: process.version,
        ELECTRON_NODE_ABI: process.versions.modules,
        // Ensure Electron's Node.js can find modules outside asar
        NODE_PATH: nodeModulesPath,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    // Listen for IPC messages from server
    serverProcess.on('message', (message: any) => {
      logToFile(`[Server IPC] ${JSON.stringify(message)}`);
      if (message.type === 'server-ready' && message.port) {
        serverPort = message.port;
        resolve(serverPort);
      }
    });

    serverProcess.stdout?.on('data', (data) => {
      const message = data.toString();
      logToFile(`[Server] ${message}`);

      // Extract port from server log
      if (serverPort === 3000) {
        const portMatch = message.match(/Server started on.*:(\d+)/);
        if (portMatch) {
          serverPort = parseInt(portMatch[1], 10);
          resolve(serverPort);
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      logToFile(`[Server Error] ${errorMsg}`);
    });

    serverProcess.on('error', (error) => {
      logToFile(`[Server] Failed to start: ${error.message}`);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      logToFile(`[Server] Exited with code ${code}`);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (serverPort === 3000) {
        const error = new Error('Server failed to start within timeout');
        logToFile(`[Server] Timeout: ${error.message}`);
        reject(error);
      }
    }, 10000);
  });
}

function createWindow(port: number): void {
  const iconPath = isDev
    ? path.join(__dirname, '../../assets/favicon.ico')
    : path.join(process.resourcesPath, 'assets/favicon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'SimpleSQL',
    icon: iconPath,
    backgroundColor: '#1e1e1e',
  });

  const startURL = isDev
    ? `http://localhost:5173/?apiPort=${port}`
    : `http://localhost:${port}`;

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    logToFile('[Electron] Starting application...');
    logToFile(`[Electron] App path: ${app.getAppPath()}`);
    logToFile(`[Electron] User data: ${app.getPath('userData')}`);
    assertRuntimeLock();
    logToFile('[Electron] Starting server...');
    
    const port = await startServer();
    logToFile(`[Electron] Server started on port ${port}`);

    // Wait a bit for server to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(port);
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logToFile(`[Electron] Failed to start application: ${errorMessage}`);
    
    // Show error dialog to user
    dialog.showErrorBox(
      'SimpleSQL Failed to Start',
      `The application failed to start. Error: ${errorMessage}\n\nLog file: ${logPath}`
    );
    
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[Electron] Shutting down...');

  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

app.on('will-quit', (event) => {
  if (serverProcess) {
    event.preventDefault();

    serverProcess.on('exit', () => {
      app.quit();
    });

    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
      app.quit();
    }, 5000);
  }
});
