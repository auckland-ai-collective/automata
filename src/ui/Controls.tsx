/**
 * The control sidebar: project selector, transport (play/pause/step/reset),
 * speed, per-project parameter widgets, and a live stats readout. Everything
 * reads from and writes to the Engine via the `useEngine` handle.
 */

import type { UseEngine } from './useEngine.ts';
import type { ParamDef } from '@core/types.ts';
import { projects } from '@projects/registry.ts';

interface Props {
  ctl: UseEngine;
}

export function Controls({ ctl }: Props): React.ReactElement {
  const { engine, running } = ctl;
  const spec = engine.spec;
  const sample = spec.sample?.(engine.state, engine.params) ?? {};

  return (
    <div className="controls">
      <section>
        <label className="field-label">Project</label>
        <select
          className="select"
          value={spec.id}
          onChange={(e) => {
            const next = projects.find((p) => p.id === e.target.value);
            if (next) ctl.load(next);
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="kind-badge">{spec.kind === 'grid' ? 'grid cellular automaton' : 'agent-based model'}</p>
        <p className="description">{spec.description}</p>
      </section>

      <section className="transport">
        {running ? (
          <button className="btn primary" onClick={ctl.pause}>❚❚ Pause</button>
        ) : (
          <button className="btn primary" onClick={ctl.play}>▶ Play</button>
        )}
        <button className="btn" onClick={ctl.stepOnce} disabled={running}>Step</button>
        <button className="btn" onClick={() => ctl.reset()}>Reset</button>
      </section>

      <section>
        <label className="field-label">
          Speed <span className="mono">{engine.speed}/s</span>
        </label>
        <input
          type="range"
          min={1}
          max={120}
          step={1}
          value={engine.speed}
          onChange={(e) => ctl.setSpeed(Number(e.target.value))}
        />
      </section>

      <section>
        <label className="field-label">
          Seed <span className="mono">{engine.seed}</span>
        </label>
        <div className="seed-row">
          <input
            className="text-input"
            type="text"
            defaultValue={engine.seed}
            key={engine.seed}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ctl.reset((e.target as HTMLInputElement).value);
            }}
          />
          <button
            className="btn"
            onClick={() => ctl.reset(Math.random().toString(36).slice(2, 8))}
            title="Random seed"
          >
            🎲
          </button>
        </div>
      </section>

      <section>
        <label className="field-label">Parameters</label>
        {spec.parameters.map((def) => (
          <ParamWidget key={def.key} def={def} ctl={ctl} />
        ))}
      </section>

      <section>
        <label className="field-label">Live stats</label>
        <div className="stats-grid">
          <StatRow label="Tick" value={engine.tick} />
          {(spec.stats ?? []).map((s) => (
            <StatRow key={s.key} label={s.label} value={Math.round(sample[s.key] ?? 0)} color={s.color} />
          ))}
        </div>
      </section>

      {spec.notes && (
        <section className="notes">
          <label className="field-label">About</label>
          <p>{spec.notes}</p>
        </section>
      )}
    </div>
  );
}

function ParamWidget({ def, ctl }: { def: ParamDef; ctl: UseEngine }): React.ReactElement {
  const value = ctl.engine.params[def.key];

  if (def.type === 'boolean') {
    return (
      <label className="param toggle">
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={(e) => ctl.setParam(def.key, e.target.checked)}
        />
        <span>{def.label}</span>
      </label>
    );
  }

  if (def.type === 'select' && def.options) {
    return (
      <label className="param">
        <span className="param-label">{def.label}</span>
        <select className="select" value={value as string} onChange={(e) => ctl.setParam(def.key, e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }

  // range / int
  return (
    <label className="param" title={def.help}>
      <span className="param-label">
        {def.label} <span className="mono">{value as number}</span>
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step ?? (def.type === 'int' ? 1 : 0.01)}
        value={value as number}
        onChange={(e) => ctl.setParam(def.key, Number(e.target.value))}
      />
    </label>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color?: string }): React.ReactElement {
  return (
    <div className="stat-row">
      <span className="dot" style={{ background: color ?? 'transparent' }} />
      <span className="stat-label">{label}</span>
      <span className="stat-value mono">{value.toLocaleString()}</span>
    </div>
  );
}
