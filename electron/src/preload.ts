// Preload script for Electron
// This runs in a secure context before the renderer process loads

import { contextBridge } from 'electron';

// Expose protected methods that allow the renderer process to use
// specific Electron APIs without exposing the entire Electron API
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
});
