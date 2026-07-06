/**
 * Standalone runner — embed a single automaton on any web page with no UI
 * framework. Because every project is a self-contained ProjectSpec and the
 * Engine is DOM-free apart from the canvas it draws to, running one anywhere
 * is a few lines:
 *
 *   import { runStandalone } from './standalone.ts';
 *   import { universe25 } from './projects/universe25/index.ts';
 *   runStandalone(universe25, document.querySelector('canvas')!, { autoplay: true });
 *
 * See standalone.html for a full example page.
 */

import { Engine } from '@core/engine.ts';
import type { ProjectSpec, Params, Viewport } from '@core/types.ts';

export interface StandaloneOptions {
  seed?: string;
  params?: Params;
  speed?: number;
  autoplay?: boolean;
}

export interface StandaloneHandle {
  engine: Engine;
  play(): void;
  pause(): void;
  reset(seed?: string): void;
  destroy(): void;
}

export function runStandalone(
  spec: ProjectSpec,
  canvas: HTMLCanvasElement,
  opts: StandaloneOptions = {},
): StandaloneHandle {
  const engine = new Engine(spec, opts.seed ?? 'utopia', opts.params);
  if (opts.speed) engine.speed = opts.speed;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  let raf = 0;
  let alive = true;

  const measure = (): Viewport => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    return { width, height, dpr };
  };

  const frame = (now: number) => {
    if (!alive) return;
    const vp = measure();
    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
    engine.advance(now);
    engine.renderTo(ctx, vp);
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  if (opts.autoplay !== false) engine.play();

  return {
    engine,
    play: () => engine.play(),
    pause: () => engine.pause(),
    reset: (seed?: string) => engine.reset(seed),
    destroy: () => {
      alive = false;
      cancelAnimationFrame(raf);
      engine.pause();
    },
  };
}
