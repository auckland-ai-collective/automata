/**
 * Bundle the Electron main + preload TypeScript into CommonJS in dist-electron/.
 * Electron's main process loads .cjs; the renderer (the web app) is built
 * separately by Vite into dist/.
 */

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-electron', { recursive: true });

const common = {
  platform: 'node',
  target: 'node20',
  bundle: true,
  format: 'cjs',
  external: ['electron'],
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: { main: 'electron/main.ts' },
  outExtension: { '.js': '.cjs' },
  outdir: 'dist-electron',
});

await build({
  ...common,
  entryPoints: { preload: 'electron/preload.ts' },
  outExtension: { '.js': '.cjs' },
  outdir: 'dist-electron',
});

console.log('✓ Electron bundles written to dist-electron/');
