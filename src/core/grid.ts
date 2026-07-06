/**
 * Grid utilities for classic cellular automata.
 *
 * A `Grid` is a flat typed array of small integer cell states with helpers for
 * neighbour access (Moore / von Neumann) and optional toroidal wrapping. Grid
 * projects double-buffer: read `cells`, write `next`, then `swap()`.
 */

export type Neighbourhood = 'moore' | 'vonNeumann';

export class Grid {
  readonly width: number;
  readonly height: number;
  cells: Uint8Array;
  next: Uint8Array;
  wrap: boolean;

  constructor(width: number, height: number, wrap = true) {
    this.width = width;
    this.height = height;
    this.wrap = wrap;
    this.cells = new Uint8Array(width * height);
    this.next = new Uint8Array(width * height);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  get(x: number, y: number): number {
    return this.cells[y * this.width + x];
  }

  set(x: number, y: number, v: number): void {
    this.cells[y * this.width + x] = v;
  }

  /** Read a cell honouring wrap mode; out-of-bounds returns 0 when not wrapping. */
  sample(x: number, y: number): number {
    const { width, height } = this;
    if (this.wrap) {
      x = ((x % width) + width) % width;
      y = ((y % height) + height) % height;
    } else if (x < 0 || y < 0 || x >= width || y >= height) {
      return 0;
    }
    return this.cells[y * width + x];
  }

  /** Count neighbours equal to `state`. */
  countNeighbours(x: number, y: number, state: number, kind: Neighbourhood = 'moore'): number {
    let n = 0;
    if (kind === 'moore') {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (this.sample(x + dx, y + dy) === state) n++;
        }
      }
    } else {
      if (this.sample(x - 1, y) === state) n++;
      if (this.sample(x + 1, y) === state) n++;
      if (this.sample(x, y - 1) === state) n++;
      if (this.sample(x, y + 1) === state) n++;
    }
    return n;
  }

  /** Commit the write buffer: `next` becomes `cells`. */
  swap(): void {
    const t = this.cells;
    this.cells = this.next;
    this.next = t;
  }

  clear(): void {
    this.cells.fill(0);
    this.next.fill(0);
  }

  /** Fraction of cells whose value is non-zero. */
  density(): number {
    let alive = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== 0) alive++;
    return alive / this.cells.length;
  }
}

/** Draw a grid to a canvas by mapping each cell state to a colour. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  palette: readonly string[],
  viewport: { width: number; height: number },
): void {
  const { width: gw, height: gh } = grid;
  const cellW = viewport.width / gw;
  const cellH = viewport.height / gh;

  ctx.fillStyle = palette[0] ?? '#000';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  // Group by colour to minimise fillStyle churn.
  for (let state = 1; state < palette.length; state++) {
    ctx.fillStyle = palette[state];
    for (let y = 0; y < gh; y++) {
      const row = y * gw;
      for (let x = 0; x < gw; x++) {
        if (grid.cells[row + x] === state) {
          ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
        }
      }
    }
  }
}
