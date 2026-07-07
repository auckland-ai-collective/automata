/**
 * Experiment: what does enclosure size do to Universe 25?
 * Runs the model across a sweep of arena sizes (holding all else equal) and
 * reports peak population, whether it went extinct, and the final mean social
 * competence — the model's memory of the behavioral sink.
 */

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
const entry = `
export { Engine } from './src/core/engine.ts';
export { universe25 } from './src/projects/universe25/index.ts';
export { defaultParams } from './src/core/types.ts';
`;
writeFileSync('.expspace-entry.ts', entry);
await build({
  entryPoints: ['.expspace-entry.ts'],
  bundle: true, format: 'esm', platform: 'node',
  outfile: '.tmp/exp.mjs', logLevel: 'error',
  alias: { '@core': './src/core', '@projects': './src/projects' },
});
const { Engine, universe25, defaultParams } =
  await import(pathToFileURL(process.cwd() + '/.tmp/exp.mjs').href);

function meanCompetence(state) {
  if (state.mice.length === 0) return 0;
  let s = 0;
  for (const m of state.mice) s += m.competence;
  return s / state.mice.length;
}

function run(arena, ticks, socialPull) {
  const params = { ...defaultParams(universe25), arena, initialPairs: 4, socialPull };
  const e = new Engine(universe25, 'utopia', params);
  e.play();
  let peak = 0, peakTick = 0, extinctAt = -1;
  let lastBirthTick = 0;
  for (let t = 0; t < ticks; t++) {
    e.step();
    const pop = e.state.mice.length;
    const s = universe25.sample(e.state, e.params);
    if (s.births > 0) lastBirthTick = t;
    if (pop > peak) { peak = pop; peakTick = t; }
    if (extinctAt < 0 && t > 5 && pop === 0) { extinctAt = t; break; }
  }
  return {
    arena,
    peak, peakTick,
    finalPop: e.state.mice.length,
    extinctAt,
    lastBirthTick,
    meanComp: meanCompetence(e.state).toFixed(2),
    density: (peak / (arena * arena)).toExponential(1),
  };
}

const TICKS = 8000;
const ARENAS = [160, 260, 400, 800, 1600, 4000];

function sweep(label, socialPull) {
  console.log(`\n=== ${label} (socialPull=${socialPull}) ===`);
  console.log('  arena     peak  @day    lastBirth   outcome                 meanComp  peakDensity');
  for (const arena of ARENAS) {
    const r = run(arena, TICKS, socialPull);
    const outcome = r.extinctAt >= 0 ? `EXTINCT @day ${r.extinctAt}` : `alive: ${r.finalPop} left`;
    console.log(
      `  ${String(arena).padStart(5)}  ${String(r.peak).padStart(7)}  ${String(r.peakTick).padStart(4)}` +
      `   ${String(r.lastBirthTick).padStart(6)}      ${outcome.padEnd(22)}  ${r.meanComp.padStart(6)}   ${r.density}`,
    );
  }
}

console.log(`Universe 25 — enclosure-size sweep (seed 'utopia', ${TICKS} days max)`);
sweep('Pure random walk — space is the constraint', 0);
sweep('Voluntary aggregation — the behavioral sink', 0.8);

rmSync('.tmp', { recursive: true, force: true });
rmSync('.expspace-entry.ts', { force: true });
