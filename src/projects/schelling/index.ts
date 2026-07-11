/**
 * Schelling's model of segregation (Thomas Schelling, 1971).
 *
 * A grid of two kinds of agents (plus empty cells). Each agent is "happy" if at
 * least a tolerance fraction of its occupied Moore-neighbours are the same kind;
 * otherwise it relocates to a random empty cell. That's the whole rule.
 *
 * The famous, unsettling result: even when every agent is perfectly content to
 * live in a mixed neighbourhood — asking only that it not be an extreme
 * minority (e.g. tolerance 0.3) — the system still segregates almost totally.
 * Mild individual preference produces stark collective separation. A landmark
 * agent-based model in social science, and a thematic sibling to Universe 25:
 * large-scale structure emerging, unintended, from local rules.
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import type { Rng } from '@core/rng.ts';
import { Grid, drawGrid } from '@core/grid.ts';

const EMPTY = 0;
// states 1 and 2 are the two groups
const PALETTE = ['#0a0e14', '#4aa3ff', '#f4a259'] as const;

interface SchellingState {
  grid: Grid;
  empties: number[]; // indices of empty cells
  happyFraction: number;
  segregation: number;
  movedLast: number;
}

function num(p: Params, k: string): number {
  return p[k] as number;
}

/** Fraction of a cell's occupied neighbours that share its group (Moore, no wrap). */
function sameFraction(grid: Grid, x: number, y: number, self: number): number {
  let same = 0;
  let occupied = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      const v = grid.get(nx, ny);
      if (v === EMPTY) continue;
      occupied++;
      if (v === self) same++;
    }
  }
  return occupied === 0 ? 1 : same / occupied; // no neighbours => content
}

export const schelling: ProjectSpec<SchellingState> = {
  id: 'schelling',
  name: 'Schelling Segregation',
  kind: 'agent',
  description: 'Mild "I want a few similar neighbours" preferences cascade into total segregation.',
  notes:
    'Thomas Schelling, 1971 (Nobel 2005). Every agent is happy in a mixed area, ' +
    'asking only not to be too small a local minority. Yet the neighbourhood ' +
    'still sorts itself into sharply separated blocks. Drag "tolerance" up to see ' +
    'how little intolerance it takes — and how even low demands still segregate.',

  parameters: [
    { key: 'size', label: 'Grid size', type: 'int', default: 100, min: 20, max: 240, step: 10, reinitOnChange: true },
    { key: 'density', label: 'Occupied fraction', type: 'range', default: 0.9, min: 0.4, max: 0.99, step: 0.01, reinitOnChange: true },
    { key: 'mix', label: 'Group A share', type: 'range', default: 0.5, min: 0.1, max: 0.9, step: 0.05, reinitOnChange: true },
    { key: 'tolerance', label: 'Wanted same-kind fraction', type: 'range', default: 0.35, min: 0, max: 0.9, step: 0.05, help: 'An agent moves if fewer than this fraction of its neighbours match it.' },
  ],

  stats: [
    { key: 'happy', label: 'Happy %', color: '#06d6a0' },
    { key: 'segregation', label: 'Segregation %', color: '#ef476f' },
  ],

  createInitialState(params, rng: Rng): SchellingState {
    const size = num(params, 'size');
    const grid = new Grid(size, size, false);
    const density = num(params, 'density');
    const mix = num(params, 'mix');
    const empties: number[] = [];
    for (let i = 0; i < grid.cells.length; i++) {
      if (rng.chance(density)) {
        grid.cells[i] = rng.chance(mix) ? 1 : 2;
      } else {
        grid.cells[i] = EMPTY;
        empties.push(i);
      }
    }
    return { grid, empties, happyFraction: 0, segregation: 0, movedLast: 0 };
  },

  step(state, params, rng): SchellingState {
    const { grid } = state;
    const w = grid.width;
    const tolerance = num(params, 'tolerance');

    // Find unhappy agents this tick.
    const unhappy: number[] = [];
    for (let i = 0; i < grid.cells.length; i++) {
      const v = grid.cells[i];
      if (v === EMPTY) continue;
      const x = i % w, y = (i / w) | 0;
      if (sameFraction(grid, x, y, v) < tolerance) unhappy.push(i);
    }

    // Move each unhappy agent to a random empty cell (Fisher–Yates over empties).
    let moved = 0;
    const empties = state.empties;
    for (const from of unhappy) {
      if (empties.length === 0) break;
      const v = grid.cells[from];
      const pick = rng.int(0, empties.length - 1);
      const to = empties[pick];
      grid.cells[to] = v;
      grid.cells[from] = EMPTY;
      // the vacated cell becomes empty; the filled cell no longer is
      empties[pick] = from;
      moved++;
    }
    state.movedLast = moved;

    // Metrics.
    let happy = 0, occupied = 0, sameSum = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      const v = grid.cells[i];
      if (v === EMPTY) continue;
      occupied++;
      const frac = sameFraction(grid, i % w, (i / w) | 0, v);
      sameSum += frac;
      if (frac >= tolerance) happy++;
    }
    state.happyFraction = occupied ? happy / occupied : 1;
    state.segregation = occupied ? sameSum / occupied : 0;
    return state;
  },

  isFinished(state): boolean {
    return state.movedLast === 0;
  },

  render(ctx, state, viewport): void {
    drawGrid(ctx, state.grid, PALETTE, viewport);
  },

  sample(state): Record<string, number> {
    return {
      happy: state.happyFraction * 100,
      segregation: state.segregation * 100,
    };
  },
};
