/**
 * Core type system for the Automata workbench.
 *
 * The central idea: a "project" is a self-contained simulation definition that
 * owns its own State type. The engine is generic over that State and knows
 * nothing about grids vs. agents — it just repeatedly calls `step` and `render`.
 *
 * This is what lets one engine host both classic cellular automata (a grid of
 * cells updated from neighbours — Conway, Wireworld) AND agent-based models
 * (individual entities with identity and behaviour — Calhoun's Universe 25).
 * The two paradigms differ only in what `State` is and how it renders.
 *
 * Nothing in this file touches the DOM except the `CanvasRenderingContext2D`
 * type used by `render`, so the engine itself runs unchanged in Electron,
 * a browser tab, a worker, or a headless test.
 */

import type { Rng } from './rng.ts';

/** How a project fundamentally represents its world. Informational — used by
 *  the UI for labelling and by renderers for sensible defaults. */
export type ModelKind = 'grid' | 'agent';

/** A tunable knob exposed to the UI. Values live in a flat `Params` record. */
export interface ParamDef {
  key: string;
  label: string;
  /** `range` -> slider, `int` -> stepper, `boolean` -> toggle, `select` -> dropdown. */
  type: 'range' | 'int' | 'boolean' | 'select';
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  /** Changing this requires rebuilding the world (a reset), not just a live tweak. */
  reinitOnChange?: boolean;
  help?: string;
}

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

/** Viewport passed to render: the pixel size of the canvas the project draws into. */
export interface Viewport {
  width: number;
  height: number;
  /** Device pixel ratio already applied to the context transform. */
  dpr: number;
}

/** A named numeric time-series channel a project emits each tick, for charts. */
export interface StatSeriesDef {
  key: string;
  label: string;
  color: string;
}

/**
 * The contract every project implements. `State` is chosen by the project.
 *
 * `step` and `render` are the hot path. Projects are free to mutate `State`
 * in place and return it (fast) or return a fresh object (pure) — the engine
 * treats the return value as authoritative either way.
 */
export interface ProjectSpec<State = unknown> {
  readonly id: string;
  readonly name: string;
  readonly kind: ModelKind;
  readonly description: string;
  /** Longer-form background shown in the UI (Markdown-ish plain text). */
  readonly notes?: string;

  readonly parameters: readonly ParamDef[];
  readonly stats?: readonly StatSeriesDef[];

  /** Build the world from scratch. Called on load, reset, or reinit-param change. */
  createInitialState(params: Params, rng: Rng): State;

  /** Advance the world by one tick. `tick` is the current step count (0-based). */
  step(state: State, params: Params, rng: Rng, tick: number): State;

  /** Draw the current state. The context transform is already scaled for DPR. */
  render(ctx: CanvasRenderingContext2D, state: State, viewport: Viewport, params: Params): void;

  /** Emit the current values of the declared `stats` series. */
  sample?(state: State, params: Params): Record<string, number>;

  /** Optional: has the simulation reached a terminal/absorbing state? */
  isFinished?(state: State, params: Params): boolean;
}

/** Convenience: extract the default Params from a spec's parameter defs. */
export function defaultParams(spec: ProjectSpec): Params {
  const p: Params = {};
  for (const def of spec.parameters) p[def.key] = def.default;
  return p;
}
