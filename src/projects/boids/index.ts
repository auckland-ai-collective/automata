/**
 * Boids — Craig Reynolds' 1986 flocking model.
 *
 * Each "boid" steers by three local rules against the neighbours it can see:
 *   1. Separation — steer away from neighbours that are too close.
 *   2. Alignment  — steer toward the average heading of neighbours.
 *   3. Cohesion   — steer toward the average position of neighbours.
 *
 * From those three, bird-flock / fish-school motion emerges with no leader and
 * no global plan. It's the archetypal agent-based model — and a close cousin of
 * the aggregation we added to Universe 25 (that was cohesion + separation; the
 * new ingredient here is alignment, which is what turns a milling blob into a
 * flowing flock).
 *
 * World is a fixed square with toroidal wrap; neighbour search is O(n^2), which
 * is fine for the low-hundreds of boids this runs.
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import type { Rng } from '@core/rng.ts';

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface BoidsState {
  boids: Boid[];
  world: number;
}

function num(p: Params, k: string): number {
  return p[k] as number;
}

const WORLD = 1000;

export const boids: ProjectSpec<BoidsState> = {
  id: 'boids',
  name: 'Boids — Flocking',
  kind: 'agent',
  description: "Reynolds' three local rules — separation, alignment, cohesion — make a flock.",
  notes:
    'Craig Reynolds, 1986. No boid knows the flock exists; each only reacts to a ' +
    'few neighbours, yet coherent flocking, splitting, and merging emerge. The ' +
    'same primitives (cohesion + separation) drive the Universe 25 mice — adding ' +
    'alignment is what produces flowing, directional motion.',

  parameters: [
    { key: 'count', label: 'Boids', type: 'int', default: 260, min: 10, max: 800, step: 10, reinitOnChange: true },
    { key: 'perception', label: 'Vision radius', type: 'range', default: 95, min: 10, max: 240, step: 5 },
    { key: 'separationDist', label: 'Personal space', type: 'range', default: 22, min: 4, max: 80, step: 1 },
    { key: 'cohesion', label: 'Cohesion', type: 'range', default: 0.9, min: 0, max: 3, step: 0.05 },
    { key: 'alignment', label: 'Alignment', type: 'range', default: 1.4, min: 0, max: 3, step: 0.05 },
    { key: 'separation', label: 'Separation', type: 'range', default: 1.3, min: 0, max: 4, step: 0.05 },
    { key: 'maxSpeed', label: 'Max speed', type: 'range', default: 4, min: 1, max: 10, step: 0.5 },
  ],

  stats: [{ key: 'polarization', label: 'Flock alignment %', color: '#4aa3ff' }],

  createInitialState(params, rng: Rng): BoidsState {
    const n = num(params, 'count');
    const boids: Boid[] = [];
    for (let i = 0; i < n; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(1, 3);
      boids.push({
        x: rng.range(0, WORLD),
        y: rng.range(0, WORLD),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
    return { boids, world: WORLD };
  },

  step(state, params): BoidsState {
    const { boids, world } = state;
    const perception = num(params, 'perception');
    const sepDist = num(params, 'separationDist');
    const wCoh = num(params, 'cohesion');
    const wAli = num(params, 'alignment');
    const wSep = num(params, 'separation');
    const maxSpeed = num(params, 'maxSpeed');
    const half = world / 2;
    const pr2 = perception * perception;
    const sr2 = sepDist * sepDist;

    // Toroidal shortest-axis delta.
    const wrapDelta = (d: number) => (d > half ? d - world : d < -half ? d + world : d);

    for (const b of boids) {
      let cx = 0, cy = 0; // cohesion: sum of neighbour positions (as offsets)
      let ax = 0, ay = 0; // alignment: sum of neighbour velocities
      let sx = 0, sy = 0; // separation: push away from too-close neighbours
      let n = 0;

      for (const o of boids) {
        if (o === b) continue;
        const dx = wrapDelta(o.x - b.x);
        const dy = wrapDelta(o.y - b.y);
        const d2 = dx * dx + dy * dy;
        if (d2 > pr2) continue;
        n++;
        cx += dx; cy += dy;
        ax += o.vx; ay += o.vy;
        if (d2 < sr2 && d2 > 0) {
          // weight inversely by distance so very close boids repel hardest
          sx -= dx / d2;
          sy -= dy / d2;
        }
      }

      if (n > 0) {
        // cohesion toward local centre of mass (unit-ish steer)
        b.vx += (cx / n) * 0.001 * wCoh;
        b.vy += (cy / n) * 0.001 * wCoh;
        // alignment toward average heading
        b.vx += (ax / n - b.vx) * 0.05 * wAli;
        b.vy += (ay / n - b.vy) * 0.05 * wAli;
        // separation
        b.vx += sx * wSep;
        b.vy += sy * wSep;
      }

      // clamp speed
      const sp = Math.hypot(b.vx, b.vy) || 1;
      if (sp > maxSpeed) {
        b.vx = (b.vx / sp) * maxSpeed;
        b.vy = (b.vy / sp) * maxSpeed;
      }
    }

    // integrate + wrap
    for (const b of boids) {
      b.x = (b.x + b.vx + world) % world;
      b.y = (b.y + b.vy + world) % world;
    }
    return state;
  },

  render(ctx, state, viewport): void {
    const { boids, world } = state;
    const scale = Math.min(viewport.width, viewport.height) / world;
    const ox = (viewport.width - world * scale) / 2;
    const oy = (viewport.height - world * scale) / 2;

    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.fillStyle = '#7fd1ff';
    const size = Math.max(2.5, scale * 6);
    for (const b of boids) {
      const px = ox + b.x * scale;
      const py = oy + b.y * scale;
      const ang = Math.atan2(b.vy, b.vx);
      // little triangle pointing along heading
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(ang) * size, py + Math.sin(ang) * size);
      ctx.lineTo(px + Math.cos(ang + 2.5) * size * 0.6, py + Math.sin(ang + 2.5) * size * 0.6);
      ctx.lineTo(px + Math.cos(ang - 2.5) * size * 0.6, py + Math.sin(ang - 2.5) * size * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  },

  sample(state): Record<string, number> {
    // Polarization = magnitude of the mean unit heading (0 = disordered, 1 = all
    // pointing the same way). A clean order parameter for the flock.
    let sx = 0, sy = 0;
    for (const b of state.boids) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      sx += b.vx / sp;
      sy += b.vy / sp;
    }
    const pol = state.boids.length ? Math.hypot(sx, sy) / state.boids.length : 0;
    return { polarization: pol * 100 };
  },
};
