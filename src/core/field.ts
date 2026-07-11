/**
 * Continuous scalar fields for reaction-diffusion and other PDE-style models.
 *
 * Where `Grid` holds small integer cell states for classic CA, `FloatField`
 * holds a double-buffered `Float32Array` of real values with a Laplacian
 * operator — the building block for Gray-Scott, Lenia, the Ising energy, BZ
 * reactions, heat diffusion, etc. Toroidal wrapping by default.
 */

export class FloatField {
  readonly width: number;
  readonly height: number;
  cur: Float32Array;
  next: Float32Array;
  wrap: boolean;

  constructor(width: number, height: number, fill = 0, wrap = true) {
    this.width = width;
    this.height = height;
    this.wrap = wrap;
    this.cur = new Float32Array(width * height).fill(fill);
    this.next = new Float32Array(width * height);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  get(x: number, y: number): number {
    return this.cur[y * this.width + x];
  }

  set(x: number, y: number, v: number): void {
    this.cur[y * this.width + x] = v;
  }

  /**
   * 9-point Laplacian (orthogonal weight 0.2, diagonal 0.05, centre -1) — the
   * standard stencil for isotropic reaction-diffusion. Honours wrap mode.
   */
  laplacian(x: number, y: number): number {
    const { width: w, height: h, cur, wrap } = this;
    const xm = x > 0 ? x - 1 : wrap ? w - 1 : x;
    const xp = x < w - 1 ? x + 1 : wrap ? 0 : x;
    const ym = y > 0 ? y - 1 : wrap ? h - 1 : y;
    const yp = y < h - 1 ? y + 1 : wrap ? 0 : y;
    const c = cur[y * w + x];
    const orth = cur[y * w + xm] + cur[y * w + xp] + cur[ym * w + x] + cur[yp * w + x];
    const diag = cur[ym * w + xm] + cur[ym * w + xp] + cur[yp * w + xm] + cur[yp * w + xp];
    return orth * 0.2 + diag * 0.05 - c;
  }

  swap(): void {
    const t = this.cur;
    this.cur = this.next;
    this.next = t;
  }

  fill(v: number): void {
    this.cur.fill(v);
  }
}

/** Map a scalar value to an RGB(A) colour. Alpha optional (defaults opaque). */
export type Colormap = (v: number) => readonly [number, number, number] | readonly [number, number, number, number];

// One offscreen canvas per field, so we blit at grid resolution then let the
// GPU scale it up — far faster than drawing thousands of rects.
const cache = new WeakMap<FloatField, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData }>();

/**
 * Draw a FloatField to a canvas via a per-pixel colormap, scaled to fill the
 * viewport with nearest-neighbour sampling (crisp cells).
 */
export function drawScalarField(
  ctx: CanvasRenderingContext2D,
  field: FloatField,
  colormap: Colormap,
  viewport: { width: number; height: number },
): void {
  const { width: w, height: h, cur } = field;
  let entry = cache.get(field);
  if (!entry) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const tctx = canvas.getContext('2d')!;
    entry = { canvas, ctx: tctx, image: tctx.createImageData(w, h) };
    cache.set(field, entry);
  }
  const data = entry.image.data;
  for (let i = 0; i < cur.length; i++) {
    const rgba = colormap(cur[i]);
    const o = i * 4;
    data[o] = rgba[0];
    data[o + 1] = rgba[1];
    data[o + 2] = rgba[2];
    data[o + 3] = rgba[3] ?? 255;
  }
  entry.ctx.putImageData(entry.image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.canvas, 0, 0, viewport.width, viewport.height);
}
