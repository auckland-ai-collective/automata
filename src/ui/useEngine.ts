/**
 * React glue between the framework-agnostic Engine and the DOM.
 *
 * `useEngine` owns a single Engine instance and drives one requestAnimationFrame
 * loop that (a) advances the model by wall-clock time and (b) renders the
 * current state to the bound canvas. React state is only used for the light
 * "tick counter" that forces control-panel re-renders; the hot path never goes
 * through React.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from '@core/engine.ts';
import type { ProjectSpec, Params, Viewport } from '@core/types.ts';

export interface UseEngine {
  engine: Engine;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  /** Bumps whenever the UI should re-read engine state (params, tick, running). */
  version: number;
  running: boolean;
  play: () => void;
  pause: () => void;
  stepOnce: () => void;
  reset: (seed?: string) => void;
  load: (spec: ProjectSpec) => void;
  setParam: (key: string, value: Params[string]) => void;
  setSpeed: (s: number) => void;
}

export function useEngine(initial: ProjectSpec, seed = 'utopia'): UseEngine {
  const engineRef = useRef<Engine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new Engine(initial, seed);
  }
  const engine = engineRef.current;

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [version, setVersion] = useState(0);
  const [running, setRunning] = useState(false);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Size the canvas backing store to its CSS box × DPR, and return a viewport.
  const measure = useCallback((canvas: HTMLCanvasElement): Viewport => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    return { width, height, dpr };
  }, []);

  // The single animation loop.
  useEffect(() => {
    let mounted = true;
    const frame = (now: number) => {
      if (!mounted) return;
      const canvas = canvasElRef.current;
      if (canvas) {
        const vp = measure(canvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
          engine.advance(now);
          engine.renderTo(ctx, vp);
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [engine, measure]);

  // Re-render the control panel a few times a second while running (for stats),
  // and immediately on lifecycle events.
  useEffect(() => {
    const offs = [
      engine.on('play', () => setRunning(true)),
      engine.on('pause', () => setRunning(false)),
      engine.on('finished', () => setRunning(false)),
      engine.on('reset', bump),
    ];
    const id = window.setInterval(bump, 200);
    return () => {
      offs.forEach((off) => off());
      window.clearInterval(id);
    };
  }, [engine, bump]);

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
  }, []);

  return {
    engine,
    canvasRef,
    version,
    running,
    play: useCallback(() => engine.play(), [engine]),
    pause: useCallback(() => engine.pause(), [engine]),
    stepOnce: useCallback(() => {
      engine.step();
      bump();
    }, [engine, bump]),
    reset: useCallback((s?: string) => engine.reset(s), [engine]),
    load: useCallback((spec: ProjectSpec) => {
      engine.load(spec);
      bump();
    }, [engine, bump]),
    setParam: useCallback((key: string, value: Params[string]) => {
      engine.setParam(key, value);
      bump();
    }, [engine, bump]),
    setSpeed: useCallback((s: number) => {
      engine.speed = s;
      bump();
    }, [engine, bump]),
  };
}
