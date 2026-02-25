import { app, BrowserWindow } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort: number = 3000;

async function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const serverPath = isDev
      ? path.join(__dirname, '../../server/src/index.ts')
      : path.join(process.resourcesPath, 'server/dist/index.js');

    const execArgv = isDev ? ['-r', 'tsx/cjs'] : [];

    serverProcess = fork(serverPath, [], {
      execArgv,
      env: {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        SERVER_PORT: '0', // Use random available port
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    serverProcess.stdout?.on('data', (data) => {
      const message = data.toString();
      console.log(`[Server] ${message}`);

      // Extract port from server log
      const portMatch = message.match(/Server started on.*:(\d+)/);
      if (portMatch) {
        serverPort = parseInt(portMatch[1], 10);
        resolve(serverPort);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[Server Error] ${data.toString()}`);
    });

    serverProcess.on('error', (error) => {
      console.error('[Server] Failed to start:', error);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Server] Exited with code ${code}`);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (serverPort === 3000) {
        reject(new Error('Server failed to start within timeout'));
      }
    }, 10000);
  });
}

function createWindow(port: number): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'SQL IDE',
    backgroundColor: '#1e1e1e',
  });

  const startURL = isDev
    ? 'http://localhost:5173'
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
    console.log('[Electron] Starting server...');
    const port = await startServer();
    console.log(`[Electron] Server started on port ${port}`);

    // Wait a bit for server to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(port);
      }
    });
  } catch (error) {
    console.error('[Electron] Failed to start application:', error);
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
