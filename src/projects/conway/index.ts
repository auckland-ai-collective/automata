/**
 * Conway's Game of Life — the canonical cellular automaton.
 *
 * A grid of cells, each alive or dead. Every tick, a cell's fate depends only
 * on its 8 Moore neighbours under the B3/S23 rule: a dead cell with exactly 3
 * live neighbours is born; a live cell survives with 2 or 3, else it dies.
 *
 * This is the "grid" archetype: State is just a Grid, step is a double-buffered
 * neighbour sweep. It shares the engine with Universe 25 to prove the hybrid.
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import type { Rng } from '@core/rng.ts';
import { Grid, drawGrid } from '@core/grid.ts';

interface ConwayState {
  grid: Grid;
  population: number;
}

const PALETTE = ['#0a0e14', '#7ee787'] as const;

function num(p: Params, k: string): number {
  return p[k] as number;
}

export const conway: ProjectSpec<ConwayState> = {
  id: 'conway',
  name: "Conway's Game of Life",
  kind: 'grid',
  description: 'The classic B3/S23 life automaton on a toroidal grid.',
  notes:
    'The 1970 automaton that made cellular automata famous. Despite trivial ' +
    'rules it is Turing-complete. Watch for still lifes, blinkers, gliders, and ' +
    'the drift toward a sparse steady state.',

  parameters: [
    { key: 'size', label: 'Grid size', type: 'int', default: 120, min: 20, max: 400, step: 10, reinitOnChange: true },
    { key: 'density', label: 'Seed density', type: 'range', default: 0.28, min: 0, max: 1, step: 0.01, reinitOnChange: true, help: 'Fraction of cells alive at start.' },
    { key: 'wrap', label: 'Wrap edges (toroidal)', type: 'boolean', default: true, reinitOnChange: true },
  ],

  stats: [{ key: 'population', label: 'Live cells', color: '#7ee787' }],

  createInitialState(params, rng: Rng): ConwayState {
    const size = num(params, 'size');
    const grid = new Grid(size, size, params.wrap as boolean);
    const density = num(params, 'density');
    let population = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      if (rng.chance(density)) {
        grid.cells[i] = 1;
        population++;
      }
    }
    return { grid, population };
  },

  step(state): ConwayState {
    const { grid } = state;
    const { width, height } = grid;
    let population = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alive = grid.get(x, y) === 1;
        const n = grid.countNeighbours(x, y, 1, 'moore');
        const nextAlive = alive ? n === 2 || n === 3 : n === 3;
        grid.next[grid.idx(x, y)] = nextAlive ? 1 : 0;
        if (nextAlive) population++;
      }
    }
    grid.swap();
    state.population = population;
    return state;
  },

  render(ctx, state, viewport): void {
    drawGrid(ctx, state.grid, PALETTE, viewport);
  },

  sample(state): Record<string, number> {
    return { population: state.population };
  },
};
