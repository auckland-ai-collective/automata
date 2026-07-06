/**
 * Electron main process. In development it loads the Vite dev server; in a
 * packaged/production build it loads the static files emitted to dist/.
 *
 * The renderer is the exact same web app that runs in a browser tab — Electron
 * is just a native shell around it, satisfying the "runs in Electron AND on the
 * web" goal with a single codebase.
 */

import { app, BrowserWindow } from 'electron';
import path from 'node:path';

// This file is bundled to CommonJS (dist-electron/main.cjs), so the CJS
// `__dirname` global is available at runtime and points at dist-electron/.
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#070a0f',
    title: 'Automata',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
