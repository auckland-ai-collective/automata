/**
 * Preload script. Currently the app needs no privileged bridge — the
 * simulation runs entirely in the renderer — but this establishes the secure
 * boundary (contextIsolation on, no nodeIntegration) for future features like
 * saving/loading project files to disk.
 */

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('automata', {
  platform: 'electron',
  version: process.versions.electron,
});
