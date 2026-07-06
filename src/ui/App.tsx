/**
 * Top-level application shell: a sidebar of controls, the simulation canvas,
 * and a live chart strip. The App is intentionally thin — all simulation logic
 * lives in the engine and projects; this just wires the canvas and panels.
 */

import { useEngine } from './useEngine.ts';
import { Controls } from './Controls.tsx';
import { Charts } from './Charts.tsx';
import { getProject, defaultProjectId } from '@projects/registry.ts';

export function App(): React.ReactElement {
  const initial = getProject(defaultProjectId)!;
  const ctl = useEngine(initial);

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="brand">
          <h1>Automata</h1>
          <span className="subtitle">cellular &amp; agent-based workbench</span>
        </header>
        <Controls ctl={ctl} />
      </aside>

      <main className="stage">
        <div className="canvas-wrap">
          <canvas ref={ctl.canvasRef} className="sim-canvas" />
        </div>
        <div className="chart-strip">
          <Charts engine={ctl.engine} version={ctl.version} />
        </div>
      </main>
    </div>
  );
}
