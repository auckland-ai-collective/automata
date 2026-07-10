/**
 * Which mechanism kills the colony — crowding, or something else?
 *
 * Key insight: in this model a mouse's competence ONLY decays under local
 * crowding (the sink ratchet). So the minimum mean-competence reached over a
 * run is a direct readout of whether crowding stressors ever fired:
 *   minComp ~ 1.0  => the mice NEVER crowded (your hypothesis holds)
 *   minComp low     => the behavioral sink happened (crowding stress fired)
 *
 * That lets us classify every run by cause of death, and directly test the
 * claim "infinite space prevents collapse."
 */

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
writeFileSync('.mech-entry.ts', `
export { Engine } from './src/core/engine.ts';
export { universe25 } from './src/projects/universe25/index.ts';
export { defaultParams } from './src/core/types.ts';
`);
await build({
  entryPoints: ['.mech-entry.ts'],
  bundle: true, format: 'esm', platform: 'node',
  outfile: '.tmp/mech.mjs', logLevel: 'error',
  alias: { '@core': './src/core', '@projects': './src/projects' },
});
const { Engine, universe25, defaultParams } =
  await import(pathToFileURL(process.cwd() + '/.tmp/mech.mjs').href);

function meanComp(mice) {
  if (mice.length === 0) return 0;
  let s = 0;
  for (const m of mice) s += m.competence;
  return s / mice.length;
}

// If a dispersing colony grows this large while still fully competent, it has
// demonstrably escaped crowding — stop early and call it a thriving colony
// rather than let unbounded exponential growth hang the run.
const THRIVE_CAP = 15000;

function run({ arena, socialPull, initialPairs }, days) {
  const params = { ...defaultParams(universe25), arena, socialPull, initialPairs };
  const e = new Engine(universe25, 'utopia', params);
  e.play();
  let peak = 0, minComp = 1, extinctAt = -1, established = false, thrived = false, sank = false;
  for (let t = 0; t < days; t++) {
    e.step();
    const pop = e.state.mice.length;
    if (pop > peak) peak = pop;
    if (pop > initialPairs * 2 * 3) established = true; // grew to 3x the seed
    // Only judge competence once there's a real colony, so a lone dying
    // founder's value doesn't dominate.
    if (pop > 20) minComp = Math.min(minComp, meanComp(e.state.mice));
    if (extinctAt < 0 && t > 5 && pop === 0) { extinctAt = t; break; }
    if (pop >= THRIVE_CAP && minComp > 0.9) { thrived = true; break; } // escaped crowding
  }
  const finalPop = e.state.mice.length;

  // A meaningful drop below ~1.0 means crowding stress fired (competence only
  // decays that way). 0.85 is a generous "basically never crowded" bar.
  const crowded = minComp <= 0.85;
  let cause;
  if (crowded) cause = extinctAt >= 0 ? 'BEHAVIORAL SINK — crowded → died' : 'crowded, surviving';
  else if (thrived || (established && extinctAt < 0)) cause = 'THRIVING — never crowded';
  else if (extinctAt >= 0) cause = 'sparse die-off — never crowded (no mates)';
  else cause = 'failed to establish';

  return { arena, socialPull, initialPairs, peak, minComp: +minComp.toFixed(2), extinctAt, finalPop, cause };
}

const DAYS = 6000;
console.log(`Cause-of-death classification (seed 'utopia', ${DAYS} days max)`);
console.log('minComp ~1.00 => crowding stressors NEVER fired.\n');

const configs = [
  // DISPERSAL world (socialPull 0) — your hypothesis: space should save them.
  { arena: 260,   socialPull: 0, initialPairs: 4 },   // small pen: fills up, crowds
  { arena: 4000,  socialPull: 0, initialPairs: 4 },   // huge pen, tiny seed: can't establish
  { arena: 4000,  socialPull: 0, initialPairs: 60 },  // huge pen, big seed: room to grow
  // AGGREGATION world (socialPull 0.35) — Calhoun's claim: space is irrelevant.
  { arena: 260,   socialPull: 0.35, initialPairs: 4 },
  { arena: 4000,  socialPull: 0.35, initialPairs: 60 },
  { arena: 12000, socialPull: 0.35, initialPairs: 60 },
];

console.log('  pull  arena   seed   peak   minComp   outcome');
for (const c of configs) {
  try {
    const r = run(c, DAYS);
    const out = r.extinctAt >= 0 ? `extinct@${r.extinctAt}` : `alive:${r.finalPop}`;
    console.log(
      `  ${String(r.socialPull).padEnd(4)}  ${String(r.arena).padStart(5)}  ${String(r.initialPairs).padStart(4)}` +
      `  ${String(r.peak).padStart(6)}   ${String(r.minComp).padStart(6)}   ${out.padEnd(13)} ${r.cause}`,
    );
  } catch (err) {
    console.log(`  ${String(c.socialPull).padEnd(4)}  ${String(c.arena).padStart(5)}  ${String(c.initialPairs).padStart(4)}  ERROR: ${err.message}`);
  }
}

rmSync('.tmp', { recursive: true, force: true });
rmSync('.mech-entry.ts', { force: true });
