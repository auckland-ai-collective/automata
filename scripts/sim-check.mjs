/**
 * Headless behavioural check: run each project for many ticks with no canvas
 * and print the trajectory. Confirms Universe 25 rises then collapses, and that
 * the grid CAs remain alive. Not a unit test — a sanity probe for the model.
 */

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });

// Bundle the engine + registry (TS with .ts import specifiers + aliases) to ESM.
// Entry lives at the project root so its relative imports resolve correctly.
const entry = `
import { Engine } from './src/core/engine.ts';
import { universe25 } from './src/projects/universe25/index.ts';
import { conway } from './src/projects/conway/index.ts';
import { wireworld } from './src/projects/wireworld/index.ts';
export { Engine, universe25, conway, wireworld };
`;
writeFileSync('.simcheck-entry.ts', entry);

await build({
  entryPoints: ['.simcheck-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: '.tmp/bundle.mjs',
  logLevel: 'error',
  alias: { '@core': './src/core', '@projects': './src/projects' },
});

const { Engine, universe25, conway, wireworld } = await import(
  pathToFileURL(process.cwd() + '/.tmp/bundle.mjs').href
);

function run(spec, ticks, sampleEvery) {
  const e = new Engine(spec, 'utopia');
  e.play();
  let peak = 0;
  let peakTick = 0;
  let extinctAt = -1;
  const hasPop = (spec.stats ?? []).some((st) => st.key === 'population');
  const marks = [];
  for (let t = 0; t < ticks; t++) {
    e.step();
    const s = spec.sample?.(e.state, e.params) ?? {};
    const pop = s.population ?? 0;
    if (pop > peak) { peak = pop; peakTick = t; }
    if (hasPop && extinctAt < 0 && t > 5 && pop === 0) extinctAt = t;
    if (t % sampleEvery === 0) marks.push({ t, ...s });
    if (extinctAt >= 0) break;
  }
  return { marks, peak, peakTick, extinctAt, finalTick: e.tick };
}

console.log('=== Universe 25 ===');
const u = run(universe25, 6000, 200);
for (const m of u.marks) {
  console.log(
    `  day ${String(m.t).padStart(4)}  pop ${String(m.population).padStart(4)}` +
    `  fertileF ${String(m.females).padStart(3)}  beautiful ${String(m.beautiful).padStart(3)}` +
    `  births ${String(m.births).padStart(2)}  deaths ${String(m.deaths).padStart(2)}`,
  );
}
console.log(`  PEAK ${u.peak} at day ${u.peakTick};  ${u.extinctAt >= 0 ? 'EXTINCT at day ' + u.extinctAt : 'still alive at day ' + u.finalTick}`);

console.log('\n=== Conway (200 ticks) ===');
const c = run(conway, 200, 50);
for (const m of c.marks) console.log(`  tick ${String(m.t).padStart(3)}  live ${m.population}`);

console.log('\n=== Wireworld (120 ticks) ===');
const w = run(wireworld, 120, 20);
for (const m of w.marks) console.log(`  tick ${String(m.t).padStart(3)}  electrons ${m.electrons}`);

rmSync('.tmp', { recursive: true, force: true });
rmSync('.simcheck-entry.ts', { force: true });
