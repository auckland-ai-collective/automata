/**
 * The simulation engine: a generic driver that runs any ProjectSpec.
 *
 * Responsibilities:
 *  - own the current State, tick counter, seed, and Params
 *  - advance the simulation at a target ticks-per-second, decoupled from the
 *    render framerate (so a slow render never distorts the model's timeline)
 *  - collect stat samples into ring-buffered history for charts
 *  - emit lifecycle events the UI subscribes to
 *
 * It is deliberately framework-agnostic: no React, no DOM beyond the canvas
 * context it hands to the project's `render`. The UI layer owns the canvas and
 * the animation frame; the engine just exposes `tick()` and `renderTo()`.
 */

import type { Params, ProjectSpec, Viewport } from './types.ts';
import { defaultParams } from './types.ts';
import { makeRng, type Rng } from './rng.ts';

export interface StatHistory {
  keys: string[];
  /** Parallel arrays, one per stat key, capped at `capacity`. */
  series: Record<string, number[]>;
  ticks: number[];
  capacity: number;
}

export type EngineEvent = 'reset' | 'tick' | 'play' | 'pause' | 'finished';
type Listener = (engine: Engine) => void;

export class Engine {
  spec: ProjectSpec;
  params: Params;
  seed: string;
  state: unknown;
  tick = 0;
  running = false;
  finished = false;

  /** Target model updates per second while running. */
  speed = 20;

  history: StatHistory;

  private rng: Rng;
  private listeners = new Map<EngineEvent, Set<Listener>>();
  private accumulator = 0;
  private lastTime = 0;

  constructor(spec: ProjectSpec, seed = 'utopia', params?: Params) {
    this.spec = spec;
    this.seed = seed;
    this.params = params ?? defaultParams(spec);
    this.rng = makeRng(seed);
    this.history = this.freshHistory();
    this.state = spec.createInitialState(this.params, this.rng);
    this.sample();
  }

  private freshHistory(): StatHistory {
    const keys = this.spec.stats?.map((s) => s.key) ?? [];
    const series: Record<string, number[]> = {};
    for (const k of keys) series[k] = [];
    return { keys, series, ticks: [], capacity: 2000 };
  }

  /** Swap in a different project, rebuilding all state. */
  load(spec: ProjectSpec, seed = this.seed, params?: Params): void {
    this.pause();
    this.spec = spec;
    this.seed = seed;
    this.params = params ?? defaultParams(spec);
    this.reset();
  }

  /** Rebuild the world from the current seed and params. */
  reset(seed = this.seed): void {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.tick = 0;
    this.finished = false;
    this.history = this.freshHistory();
    this.state = this.spec.createInitialState(this.params, this.rng);
    this.sample();
    this.emit('reset');
  }

  setParam(key: string, value: Params[string]): void {
    this.params = { ...this.params, [key]: value };
    const def = this.spec.parameters.find((p) => p.key === key);
    if (def?.reinitOnChange) this.reset();
  }

  play(): void {
    if (this.finished) this.reset();
    this.running = true;
    this.accumulator = 0;
    this.lastTime = 0;
    this.emit('play');
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.emit('pause');
  }

  /** Advance exactly one model tick (used by both the loop and single-step). */
  step(): void {
    if (this.finished) return;
    this.state = this.spec.step(this.state, this.params, this.rng, this.tick);
    this.tick++;
    this.sample();
    if (this.spec.isFinished?.(this.state, this.params)) {
      this.finished = true;
      this.running = false;
      this.emit('finished');
    }
    this.emit('tick');
  }

  /**
   * Drive the model forward by wall-clock time. Call this once per animation
   * frame with the frame timestamp; it runs as many discrete ticks as the
   * elapsed time and target `speed` demand (capped to avoid spiral-of-death).
   */
  advance(now: number): void {
    if (!this.running) return;
    if (this.lastTime === 0) this.lastTime = now;
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.accumulator += dt;

    const interval = 1 / this.speed;
    let budget = 240; // hard cap on ticks per frame
    while (this.accumulator >= interval && budget-- > 0) {
      this.accumulator -= interval;
      this.step();
      if (!this.running) break;
    }
  }

  private sample(): void {
    if (!this.spec.sample || this.history.keys.length === 0) return;
    const values = this.spec.sample(this.state, this.params);
    const h = this.history;
    h.ticks.push(this.tick);
    for (const k of h.keys) h.series[k].push(values[k] ?? 0);
    if (h.ticks.length > h.capacity) {
      h.ticks.shift();
      for (const k of h.keys) h.series[k].shift();
    }
  }

  renderTo(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    this.spec.render(ctx, this.state, viewport, this.params);
  }

  on(event: EngineEvent, fn: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  private emit(event: EngineEvent): void {
    const set = this.listeners.get(event);
    if (set) for (const fn of set) fn(this);
  }
}
