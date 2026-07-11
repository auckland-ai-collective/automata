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
          <div className="title-row">
            <h1>Automata</h1>
            <span className="version">v{__APP_VERSION__}</span>
          </div>
          <span className="subtitle">cellular &amp; agent-based workbench</span>
          <a
            className="repo-link"
            href="https://github.com/auckland-ai-collective/automata"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
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
