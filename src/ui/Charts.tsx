/**
 * Live line chart of the engine's stat history, drawn to a canvas. Each
 * declared stat series is plotted against tick count with its own colour and
 * an auto-scaled Y axis (shared across series so magnitudes are comparable).
 */

import { useEffect, useRef } from 'react';
import type { Engine } from '@core/engine.ts';

interface Props {
  engine: Engine;
  version: number;
}

export function Charts({ engine, version }: Props): React.ReactElement {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    const { history } = engine;
    const specStats = engine.spec.stats ?? [];
    if (history.ticks.length < 2 || specStats.length === 0) {
      ctx.fillStyle = '#3a4a63';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('Collecting data…', 10, 18);
      return;
    }

    // Shared Y scale across all series.
    let maxY = 1;
    for (const s of specStats) {
      for (const v of history.series[s.key]) if (v > maxY) maxY = v;
    }
    maxY *= 1.1;

    const n = history.ticks.length;
    const x0 = 6;
    const x1 = w - 6;
    const y0 = h - 18;
    const y1 = 6;
    const xAt = (i: number) => x0 + ((x1 - x0) * i) / (n - 1);
    const yAt = (v: number) => y0 + ((y1 - y0) * v) / maxY;

    // Axis baseline.
    ctx.strokeStyle = '#1c2534';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.stroke();

    for (const s of specStats) {
      const data = history.series[s.key];
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = xAt(i);
        const py = yAt(data[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Peak label.
    ctx.fillStyle = '#3a4a63';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`max ${Math.round(maxY / 1.1)}`, x0 + 2, y1 + 2);
    ctx.fillText(`tick ${history.ticks[n - 1]}`, x1 - 60, y0 - 12);
    void version;
  }, [engine, version]);

  return <canvas ref={ref} className="chart-canvas" />;
}
