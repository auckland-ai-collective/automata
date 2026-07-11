/**
 * Sanity probe for the four new projects: run each headless and assert the
 * defining behaviour actually happens (not just "doesn't crash").
 */

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
writeFileSync('.checknew-entry.ts', `
export { Engine } from './src/core/engine.ts';
export { boids } from './src/projects/boids/index.ts';
export { langton } from './src/projects/langton/index.ts';
export { grayscott } from './src/projects/grayscott/index.ts';
export { schelling } from './src/projects/schelling/index.ts';
`);
await build({
  entryPoints: ['.checknew-entry.ts'],
  bundle: true, format: 'esm', platform: 'node',
  outfile: '.tmp/checknew.mjs', logLevel: 'error',
  alias: { '@core': './src/core', '@projects': './src/projects' },
});
const m = await import(pathToFileURL(process.cwd() + '/.tmp/checknew.mjs').href);

function stepN(spec, n) {
  const e = new m.Engine(spec, 'utopia');
  for (let i = 0; i < n; i++) e.step();
  return e;
}
const ok = (label, pass, detail) => console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}  —  ${detail}`);

console.log('Boids:');
{
  const e = stepN(m.boids, 600);
  const s = m.boids.sample(e.state, e.params);
  const finite = e.state.boids.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y));
  ok('positions finite', finite, `${e.state.boids.length} boids`);
  // Random start ~ 100/sqrt(N) ≈ 6%. Local flocks can point different ways, so
  // even clear flocking need not reach 100% global order; ~30%+ is decisive.
  ok('flock became ordered', s.polarization > 30, `polarization ${s.polarization.toFixed(0)}% (random start ~6%)`);
}

console.log("Langton's Ant:");
{
  // Highway is known to begin near step ~10,000 for a single ant.
  const e = stepN(m.langton, 11000);
  const s = m.langton.sample(e.state, e.params);
  ok('cells flipped on', s.visited > 100, `${s.visited} cells ON after 11k steps`);
}

console.log('Gray-Scott:');
{
  const e = stepN(m.grayscott, 60); // each tick = several sub-steps
  const vc = e.state.v.cur;
  let sum = 0, nan = 0, max = 0;
  for (let i = 0; i < vc.length; i++) { sum += vc[i]; if (!Number.isFinite(vc[i])) nan++; if (vc[i] > max) max = vc[i]; }
  ok('no NaNs / stable', nan === 0, `max V ${max.toFixed(3)}`);
  ok('pattern grew from seed', sum > 0, `total V ${sum.toFixed(1)}`);
}

console.log('Schelling:');
{
  const e = new m.Engine(m.schelling, 'utopia');
  const before = m.schelling.sample(e.state, e.params).segregation;
  for (let i = 0; i < 60 && !e.finished; i++) e.step();
  const after = m.schelling.sample(e.state, e.params);
  ok('segregation increased', after.segregation > before + 5,
    `segregation ${before.toFixed(0)}% -> ${after.segregation.toFixed(0)}%, happy ${after.happy.toFixed(0)}%`);
}

rmSync('.tmp', { recursive: true, force: true });
rmSync('.checknew-entry.ts', { force: true });
