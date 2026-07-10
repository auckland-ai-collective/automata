/**
 * Diagnostic: what does the movement algorithm actually DO in space over time?
 *
 * The population-vs-arena sweep only showed outcomes. This measures the spatial
 * behaviour that produces them, sampling every N days:
 *   - pop           population
 *   - meanNbrs      mean neighbours within the crowd radius (the real crowding
 *                   the model reacts to — tolerance is 7)
 *   - spread        RMS distance of mice from their collective centroid, in
 *                   enclosure units (how spatially concentrated they are)
 *   - clusters      number of contiguous groups (union-find, link <= crowd r)
 *   - occupancy     spread as a fraction of the arena half-width (are they
 *                   filling the pen, or huddled in a corner of it?)
 *   - meanComp      mean social competence (the ratchet; 1 healthy, 0 dead)
 *
 * Run three configs to separate the mechanism from the setting.
 */

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
writeFileSync('.diag-entry.ts', `
export { Engine } from './src/core/engine.ts';
export { universe25 } from './src/projects/universe25/index.ts';
export { defaultParams } from './src/core/types.ts';
`);
await build({
  entryPoints: ['.diag-entry.ts'],
  bundle: true, format: 'esm', platform: 'node',
  outfile: '.tmp/diag.mjs', logLevel: 'error',
  alias: { '@core': './src/core', '@projects': './src/projects' },
});
const { Engine, universe25, defaultParams } =
  await import(pathToFileURL(process.cwd() + '/.tmp/diag.mjs').href);

const CROWD_R = 10; // matches default crowdRadius

function metrics(mice, arena) {
  const n = mice.length;
  if (n === 0) return { meanNbrs: 0, spread: 0, clusters: 0, occupancy: 0, meanComp: 0 };

  // centroid + spread
  let mx = 0, my = 0, comp = 0;
  for (const m of mice) { mx += m.x; my += m.y; comp += m.competence; }
  mx /= n; my /= n; comp /= n;
  let ss = 0;
  for (const m of mice) ss += (m.x - mx) ** 2 + (m.y - my) ** 2;
  const spread = Math.sqrt(ss / n);

  // mean neighbours within crowd radius (O(n^2); n is small here)
  const r2 = CROWD_R * CROWD_R;
  let nbrSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = mice[i].x - mice[j].x, dy = mice[i].y - mice[j].y;
      if (dx * dx + dy * dy <= r2) { nbrSum += 2; }
    }
  }
  const meanNbrs = nbrSum / n;

  // clusters via union-find, link if within crowd radius
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = mice[i].x - mice[j].x, dy = mice[i].y - mice[j].y;
      if (dx * dx + dy * dy <= r2) { parent[find(i)] = find(j); }
    }
  }
  const roots = new Set();
  for (let i = 0; i < n; i++) roots.add(find(i));

  return {
    meanNbrs: +meanNbrs.toFixed(1),
    spread: +spread.toFixed(1),
    clusters: roots.size,
    occupancy: +(spread / (arena / 2)).toFixed(2),
    meanComp: +comp.toFixed(2),
  };
}

function run(label, { arena, socialPull }, days, every) {
  const params = { ...defaultParams(universe25), arena, initialPairs: 4, socialPull };
  const e = new Engine(universe25, 'utopia', params);
  e.play();
  console.log(`\n=== ${label}  (arena=${arena}, socialPull=${socialPull}) ===`);
  console.log('  day   pop  meanNbrs  spread  clusters  occupancy  meanComp');
  for (let t = 0; t <= days; t++) {
    if (t % every === 0) {
      const m = metrics(e.state.mice, arena);
      console.log(
        `  ${String(t).padStart(4)}  ${String(e.state.mice.length).padStart(4)}` +
        `   ${String(m.meanNbrs).padStart(6)}  ${String(m.spread).padStart(6)}` +
        `  ${String(m.clusters).padStart(7)}   ${String(m.occupancy).padStart(7)}   ${String(m.meanComp).padStart(6)}`,
      );
      if (e.state.mice.length === 0) break;
    }
    e.step();
  }
}

console.log("Movement diagnostic — Universe 25 (seed 'utopia')");
console.log('crowd tolerance = 7 neighbours; above that, crowding stress accrues.');
run('DEFAULT: mild pull', { arena: 260, socialPull: 0.35 }, 1400, 100);
run('SAME PULL, huge pen', { arena: 1600, socialPull: 0.35 }, 1400, 100);
run('NO pull, huge pen', { arena: 1600, socialPull: 0 }, 1400, 100);

rmSync('.tmp', { recursive: true, force: true });
rmSync('.diag-entry.ts', { force: true });
