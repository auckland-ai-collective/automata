/**
 * Gray-Scott reaction-diffusion — two chemicals U and V that react and diffuse:
 *
 *   U + 2V -> 3V     (V consumes U to reproduce itself)
 *          V -> P     (V decays)
 *
 * Discretised per cell (dt = 1):
 *   U' = U + Du·∇²U − U·V² + feed·(1 − U)
 *   V' = V + Dv·∇²V + U·V² − (feed + kill)·V
 *
 * Despite being just diffusion plus a quadratic reaction, tiny changes to the
 * feed and kill rates yield wildly different self-organising patterns — spots,
 * stripes, mazes, dividing "cells", travelling waves. It's the canonical demo
 * of Turing morphogenesis and one of the most beautiful things a CA workbench
 * can show. Built on the engine's FloatField (which also unlocks Lenia, Ising,
 * BZ reactions, heat diffusion, ...).
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import type { Rng } from '@core/rng.ts';
import { FloatField, drawScalarField, type Colormap } from '@core/field.ts';

interface GrayScottState {
  u: FloatField;
  v: FloatField;
}

// Named feed/kill regimes — the famous corners of Gray-Scott parameter space.
const PATTERNS: Record<string, { feed: number; kill: number }> = {
  mitosis: { feed: 0.0367, kill: 0.0649 },
  coral: { feed: 0.0545, kill: 0.062 },
  spots: { feed: 0.03, kill: 0.062 },
  maze: { feed: 0.029, kill: 0.057 },
  stripes: { feed: 0.022, kill: 0.051 },
  waves: { feed: 0.014, kill: 0.045 },
  worms: { feed: 0.058, kill: 0.065 },
};

const Du = 0.16;
const Dv = 0.08;

function num(p: Params, k: string): number {
  return p[k] as number;
}
function str(p: Params, k: string): string {
  return p[k] as string;
}

function feedKill(params: Params): { feed: number; kill: number } {
  const pattern = str(params, 'pattern');
  if (pattern === 'custom') return { feed: num(params, 'feed'), kill: num(params, 'kill') };
  return PATTERNS[pattern] ?? PATTERNS.coral;
}

// Dark-teal -> cyan -> white ramp on V, which reads as glowing structure on black.
const colormap: Colormap = (v) => {
  const t = Math.max(0, Math.min(1, v * 3.2));
  const r = Math.min(255, Math.max(0, (t - 0.5) * 2) * 255);
  const g = Math.min(255, t * 255);
  const b = Math.min(255, (0.3 + t * 0.7) * 255);
  return [r * 0.9, g, b];
};

export const grayscott: ProjectSpec<GrayScottState> = {
  id: 'grayscott',
  name: 'Gray-Scott Reaction-Diffusion',
  kind: 'grid',
  description: 'Two reacting chemicals self-organise into spots, stripes, mazes and dividing cells.',
  notes:
    'A model of Turing morphogenesis — the maths behind animal coat patterns. ' +
    'Pick a pattern preset, or choose "custom" and nudge the feed/kill rates: ' +
    'the boundaries between regimes are razor-thin and endlessly explorable. ' +
    'Reset paints a fresh seed of chemical V in the centre.',

  parameters: [
    { key: 'size', label: 'Grid size', type: 'int', default: 200, min: 64, max: 320, step: 8, reinitOnChange: true },
    {
      key: 'pattern', label: 'Pattern', type: 'select', default: 'coral',
      options: [
        { value: 'coral', label: 'Coral' },
        { value: 'mitosis', label: 'Mitosis (dividing cells)' },
        { value: 'spots', label: 'Spots' },
        { value: 'maze', label: 'Maze' },
        { value: 'stripes', label: 'Stripes' },
        { value: 'waves', label: 'Waves' },
        { value: 'worms', label: 'Worms' },
        { value: 'custom', label: 'Custom (use sliders)' },
      ],
    },
    { key: 'feed', label: 'Feed rate (custom)', type: 'range', default: 0.037, min: 0.01, max: 0.09, step: 0.001 },
    { key: 'kill', label: 'Kill rate (custom)', type: 'range', default: 0.06, min: 0.03, max: 0.07, step: 0.001 },
    { key: 'stepsPerTick', label: 'Sim steps / frame', type: 'int', default: 8, min: 1, max: 30, step: 1, help: 'Reaction-diffusion evolves slowly; run several sub-steps per rendered frame.' },
  ],

  stats: [{ key: 'totalV', label: 'Total V (×100)', color: '#22d3ee' }],

  createInitialState(params, rng: Rng): GrayScottState {
    const size = num(params, 'size');
    const u = new FloatField(size, size, 1); // U starts saturated
    const v = new FloatField(size, size, 0); // V starts empty
    // Seed a noisy square of V in the centre to break symmetry.
    const r = Math.max(4, size >> 4);
    const c = size >> 1;
    for (let y = c - r; y < c + r; y++) {
      for (let x = c - r; x < c + r; x++) {
        u.set(x, y, 0.5 + rng.range(-0.02, 0.02));
        v.set(x, y, 0.25 + rng.range(-0.02, 0.02));
      }
    }
    return { u, v };
  },

  step(state, params): GrayScottState {
    const { u, v } = state;
    const { feed, kill } = feedKill(params);
    const sub = num(params, 'stepsPerTick');
    const w = u.width, h = u.height;

    for (let s = 0; s < sub; s++) {
      const uc = u.cur, vc = v.cur, un = u.next, vn = v.next;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const uu = uc[i];
          const vv = vc[i];
          const uvv = uu * vv * vv;
          const lu = u.laplacian(x, y);
          const lv = v.laplacian(x, y);
          let nu = uu + Du * lu - uvv + feed * (1 - uu);
          let nv = vv + Dv * lv + uvv - (feed + kill) * vv;
          // clamp to valid range for numerical safety
          un[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
          vn[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
        }
      }
      u.swap();
      v.swap();
    }
    return state;
  },

  render(ctx, state, viewport): void {
    drawScalarField(ctx, state.v, colormap, viewport);
  },

  sample(state): Record<string, number> {
    const vc = state.v.cur;
    let sum = 0;
    for (let i = 0; i < vc.length; i++) sum += vc[i];
    return { totalV: (sum / vc.length) * 100 };
  },
};
