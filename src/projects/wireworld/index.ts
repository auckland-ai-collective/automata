/**
 * Wireworld — a cellular automaton that simulates electronic logic.
 *
 * Four states: empty, conductor, electron head, electron tail. Electrons flow
 * along conductor "wires" and the rules make diodes, gates, and clocks possible.
 * We seed a rectangular wire loop with one electron so there is always visible
 * motion; users can extend the circuit by editing the seed.
 *
 * Rules per tick:
 *   empty          -> empty
 *   electron head  -> electron tail
 *   electron tail  -> conductor
 *   conductor      -> electron head IF 1 or 2 of its 8 neighbours are heads,
 *                     otherwise stays conductor.
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import { Grid, drawGrid } from '@core/grid.ts';

const EMPTY = 0;
const CONDUCTOR = 1;
const HEAD = 2;
const TAIL = 3;

// index 0..3 -> colour
const PALETTE = ['#0a0e14', '#3a4a63', '#ffd166', '#ef476f'] as const;

interface WireworldState {
  grid: Grid;
  electrons: number;
}

function num(p: Params, k: string): number {
  return p[k] as number;
}

/** Lay down a rectangular loop of conductor with one electron circulating. */
function seedLoop(grid: Grid, margin: number): void {
  const { width, height } = grid;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin - 1;
  const y1 = height - margin - 1;
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) grid.set(x, y, v);
  };

  for (let x = x0; x <= x1; x++) {
    put(x, y0, CONDUCTOR);
    put(x, y1, CONDUCTOR);
  }
  for (let y = y0; y <= y1; y++) {
    put(x0, y, CONDUCTOR);
    put(x1, y, CONDUCTOR);
  }
  // Inject one electron (head + tail) on the top edge so it travels clockwise.
  put(x0 + 2, y0, HEAD);
  put(x0 + 1, y0, TAIL);
}

export const wireworld: ProjectSpec<WireworldState> = {
  id: 'wireworld',
  name: 'Wireworld',
  kind: 'grid',
  description: 'A 4-state CA where electrons flow along wires — build logic gates.',
  notes:
    'Introduced by Brian Silverman in 1987. Wireworld is Turing-complete and has ' +
    'been used to build a working digital computer. The seed here is a simple ' +
    'conductor loop carrying a single circulating electron.',

  parameters: [
    { key: 'size', label: 'Grid size', type: 'int', default: 60, min: 20, max: 200, step: 5, reinitOnChange: true },
    { key: 'margin', label: 'Loop margin', type: 'int', default: 6, min: 2, max: 40, step: 1, reinitOnChange: true, help: 'Distance of the wire loop from the grid edge.' },
  ],

  stats: [{ key: 'electrons', label: 'Electron heads', color: '#ffd166' }],

  createInitialState(params): WireworldState {
    const size = num(params, 'size');
    const grid = new Grid(size, size, false);
    seedLoop(grid, num(params, 'margin'));
    return { grid, electrons: 1 };
  },

  step(state): WireworldState {
    const { grid } = state;
    const { width, height } = grid;
    let electrons = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const s = grid.get(x, y);
        let ns = s;
        switch (s) {
          case EMPTY:
            ns = EMPTY;
            break;
          case HEAD:
            ns = TAIL;
            break;
          case TAIL:
            ns = CONDUCTOR;
            break;
          case CONDUCTOR: {
            const heads = grid.countNeighbours(x, y, HEAD, 'moore');
            ns = heads === 1 || heads === 2 ? HEAD : CONDUCTOR;
            break;
          }
        }
        if (ns === HEAD) electrons++;
        grid.next[grid.idx(x, y)] = ns;
      }
    }
    grid.swap();
    state.electrons = electrons;
    return state;
  },

  render(ctx, state, viewport): void {
    drawGrid(ctx, state.grid, PALETTE, viewport);
  },

  sample(state): Record<string, number> {
    return { electrons: state.electrons };
  },
};
