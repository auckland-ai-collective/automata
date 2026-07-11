/**
 * Langton's Ant — a two-state "turmite" (Turing-machine ant).
 *
 * An ant sits on a grid of cells that are OFF or ON. Each step:
 *   - on an OFF cell: turn right 90°, flip the cell ON, move forward one;
 *   - on an ON cell:  turn left 90°,  flip the cell OFF, move forward one.
 *
 * From this two-line rule the ant produces ~10,000 steps of apparent chaos and
 * then, abruptly and unavoidably, starts building a periodic diagonal
 * "highway" forever — a striking example of emergent order from a trivial rule.
 * Multiple ants interact and can dismantle each other's highways.
 *
 * A grid CA with a moving read/write head — the natural bridge between the
 * grid projects (Conway, Wireworld) and the agent projects (Boids, Universe 25).
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import type { Rng } from '@core/rng.ts';
import { Grid, drawGrid } from '@core/grid.ts';

interface Ant {
  x: number;
  y: number;
  dir: number; // 0=up, 1=right, 2=down, 3=left
  color: string;
}

interface LangtonState {
  grid: Grid;
  ants: Ant[];
  visited: number;
}

const PALETTE = ['#0a0e14', '#dbe4f0'] as const;
const ANT_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#4aa3ff', '#c77dff', '#ff924c'];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

function num(p: Params, k: string): number {
  return p[k] as number;
}

export const langton: ProjectSpec<LangtonState> = {
  id: 'langton',
  name: "Langton's Ant",
  kind: 'grid',
  description: 'A two-rule ant that descends into chaos, then builds an ordered highway.',
  notes:
    'Chris Langton, 1986. Watch a single ant: for ~10,000 steps its trail looks ' +
    'random, then it locks into a repeating 104-step cycle that walks a diagonal ' +
    '"highway" off to infinity. Add more ants to see them interfere. Turn up the ' +
    'speed to skip ahead to the highway.',

  parameters: [
    { key: 'size', label: 'Grid size', type: 'int', default: 150, min: 40, max: 400, step: 10, reinitOnChange: true },
    { key: 'ants', label: 'Ant count', type: 'int', default: 1, min: 1, max: 6, step: 1, reinitOnChange: true },
    { key: 'wrap', label: 'Wrap edges', type: 'boolean', default: true, reinitOnChange: true },
  ],

  stats: [{ key: 'visited', label: 'Cells flipped ON', color: '#dbe4f0' }],

  createInitialState(params, rng: Rng): LangtonState {
    const size = num(params, 'size');
    const grid = new Grid(size, size, params.wrap as boolean);
    const count = num(params, 'ants');
    const ants: Ant[] = [];
    for (let i = 0; i < count; i++) {
      ants.push({
        x: count === 1 ? (size >> 1) : rng.int(size >> 2, size - (size >> 2)),
        y: count === 1 ? (size >> 1) : rng.int(size >> 2, size - (size >> 2)),
        dir: rng.int(0, 3),
        color: ANT_COLORS[i % ANT_COLORS.length],
      });
    }
    return { grid, ants, visited: 0 };
  },

  step(state): LangtonState {
    const { grid, ants } = state;
    const { width, height } = grid;
    for (const ant of ants) {
      const on = grid.get(ant.x, ant.y) === 1;
      // OFF -> turn right (+1); ON -> turn left (+3 mod 4)
      ant.dir = (ant.dir + (on ? 3 : 1)) & 3;
      grid.set(ant.x, ant.y, on ? 0 : 1);
      state.visited += on ? -1 : 1;
      let nx = ant.x + DX[ant.dir];
      let ny = ant.y + DY[ant.dir];
      if (grid.wrap) {
        nx = (nx + width) % width;
        ny = (ny + height) % height;
      } else {
        nx = Math.max(0, Math.min(width - 1, nx));
        ny = Math.max(0, Math.min(height - 1, ny));
      }
      ant.x = nx;
      ant.y = ny;
    }
    return state;
  },

  render(ctx, state, viewport): void {
    const { grid, ants } = state;
    drawGrid(ctx, grid, PALETTE, viewport);
    const cw = viewport.width / grid.width;
    const ch = viewport.height / grid.height;
    for (const ant of ants) {
      ctx.fillStyle = ant.color;
      ctx.fillRect(ant.x * cw, ant.y * ch, Math.ceil(cw), Math.ceil(ch));
    }
  },

  sample(state): Record<string, number> {
    return { visited: state.visited };
  },
};
