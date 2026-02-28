// Preload script for Electron
// This runs in a secure context before the renderer process loads

import { contextBridge, ipcRenderer } from 'electron';

type UpdateStatusEvent = {
  status: 'available' | 'downloading' | 'downloaded' | 'error' | string;
  version?: string;
  percent?: number;
  message?: string;
};

function getApiAuthToken(): string {
  const supportedPrefixes = ['sqlideApiToken=', '--sqlideApiToken='];
  const tokenArg = process.argv.find((arg) => supportedPrefixes.some((prefix) => arg.startsWith(prefix)));
  if (!tokenArg) {
    return '';
  }
  const matchingPrefix = supportedPrefixes.find((prefix) => tokenArg.startsWith(prefix));
  if (!matchingPrefix) {
    return '';
  }
  return tokenArg.slice(matchingPrefix.length);
}

// Expose protected methods that allow the renderer process to use
// specific Electron APIs without exposing the entire Electron API
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  apiAuthToken: getApiAuthToken(),
  checkForUpdates: async () => ipcRenderer.invoke('app:check-for-updates'),
  onUpdateStatus: (callback: (event: UpdateStatusEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UpdateStatusEvent) => {
      callback(payload);
    };

    ipcRenderer.on('app:update-status', listener);

    return () => {
      ipcRenderer.removeListener('app:update-status', listener);
    };
  },
});
