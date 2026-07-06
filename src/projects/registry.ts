/**
 * The project registry: every simulation the workbench can run.
 *
 * Adding a new automaton or agent model is a one-line change here plus its
 * module. Each project is a self-contained `ProjectSpec`, so it can also be
 * imported and run entirely on its own (see src/standalone.ts) without the UI.
 */

import type { ProjectSpec } from '@core/types.ts';
import { conway } from './conway/index.ts';
import { wireworld } from './wireworld/index.ts';
import { universe25 } from './universe25/index.ts';

export const projects: ProjectSpec[] = [universe25, conway, wireworld];

export function getProject(id: string): ProjectSpec | undefined {
  return projects.find((p) => p.id === id);
}

export const defaultProjectId = universe25.id;
