/**
 * Universe 25 — John B. Calhoun's mouse-utopia experiment (1968–1973).
 *
 * Calhoun placed four breeding pairs of mice into an enclosure with unlimited
 * food, water, and nesting material, no predators, and no disease. The only
 * finite resource was *space* — and therefore social space. The colony grew
 * exponentially, peaked around 2,200, then suffered total social breakdown and
 * went extinct. This is the phenomenon he named the "behavioral sink."
 *
 * This is the "agent" archetype for the workbench: unlike a grid CA, State is a
 * population of individual mice, each with identity, sex, age, position, and
 * social condition. The collapse is *emergent* from local crowding rules — it
 * is not scripted. Four dynamics drive it:
 *
 *   1. Fertility falls as local density rises (females stop conceiving).
 *   2. Maternal neglect: pups born into crowding die young.
 *   3. The "beautiful ones": males maturing under high density withdraw
 *      entirely — they eat, sleep, and groom but never court or fight, and so
 *      never reproduce. They live long but are reproductively dead.
 *   4. Density stress raises mortality among the socially engaged.
 *
 * Together these produce Calhoun's four phases: Strive, Exploit (growth),
 * Stagnation (equilibrium + breakdown), and Death (decline to extinction).
 *
 * All constants are exposed as parameters so the model can be explored, not
 * just replayed. Time base: 1 tick = 1 day.
 */

import type { ProjectSpec, Params } from '@core/types.ts';
import type { Rng } from '@core/rng.ts';

type Sex = 'M' | 'F';

interface Mouse {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sex: Sex;
  age: number; // days
  /** Withdrawn male ("beautiful one") — never mates or fights. */
  beautiful: boolean;
  /**
   * Social competence in [0,1]: the capacity to rear young (females) and to
   * court and defend territory (males). Set once at birth from the conditions
   * the pup is reared in and NEVER recovers. This is the model's memory of the
   * behavioral sink — it is what makes the collapse terminal rather than a
   * self-correcting boom/bust. A generation raised in dysfunction can only
   * produce a still-less-competent generation.
   */
  competence: number;
  /** Cumulative social-stress load, feeds pathology. */
  stress: number;
  /** Tick of last successful conception (females). */
  lastBirth: number;
  generation: number;
  lifespan: number; // individual death age (days)
}

type Phase = 'A · Strive' | 'B · Exploit' | 'C · Stagnation' | 'D · Death' | 'Extinct';

interface Universe25State {
  mice: Mouse[];
  arena: number; // square enclosure side, abstract units
  nextId: number;
  generationOfPeak: number;
  peak: number;
  phase: Phase;
  // Rolling counters (per tick) for stats.
  birthsToday: number;
  deathsToday: number;
  lastConception: number; // tick of most recent conception
}

// ---- helpers ---------------------------------------------------------------

function num(p: Params, k: string): number {
  return p[k] as number;
}

/**
 * Spatial hash for O(n) neighbour queries. Rebuilt each tick. Buckets are
 * sized to the crowding radius so a mouse only needs to scan its own and the
 * eight adjacent buckets to count everyone within range.
 */
class SpatialHash {
  private cell: number;
  private cols: number;
  private buckets: Map<number, Mouse[]> = new Map();

  constructor(arena: number, radius: number) {
    this.cell = Math.max(1, radius);
    this.cols = Math.ceil(arena / this.cell) + 1;
    // buckets built lazily in insert()
  }

  private key(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  insert(m: Mouse): void {
    const cx = Math.floor(m.x / this.cell);
    const cy = Math.floor(m.y / this.cell);
    const k = this.key(cx, cy);
    let b = this.buckets.get(k);
    if (!b) {
      b = [];
      this.buckets.set(k, b);
    }
    b.push(m);
  }

  /** Count mice within `radius` of (x,y), optionally filtered. Excludes self by id. */
  countNear(x: number, y: number, radius: number, selfId: number, filter?: (m: Mouse) => boolean): number {
    const r2 = radius * radius;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const b = this.buckets.get(this.key(cx + dx, cy + dy));
        if (!b) continue;
        for (const m of b) {
          if (m.id === selfId) continue;
          const ddx = m.x - x;
          const ddy = m.y - y;
          if (ddx * ddx + ddy * ddy <= r2 && (!filter || filter(m))) count++;
        }
      }
    }
    return count;
  }

  /** First matching mouse within radius, or null. */
  findNear(x: number, y: number, radius: number, selfId: number, filter: (m: Mouse) => boolean): Mouse | null {
    const r2 = radius * radius;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const b = this.buckets.get(this.key(cx + dx, cy + dy));
        if (!b) continue;
        for (const m of b) {
          if (m.id === selfId) continue;
          const ddx = m.x - x;
          const ddy = m.y - y;
          if (ddx * ddx + ddy * ddy <= r2 && filter(m)) return m;
        }
      }
    }
    return null;
  }
}

function makeMouse(
  id: number,
  x: number,
  y: number,
  sex: Sex,
  generation: number,
  rng: Rng,
  lifespan: number,
  competence: number,
): Mouse {
  return {
    id,
    x,
    y,
    vx: rng.range(-1, 1),
    vy: rng.range(-1, 1),
    sex,
    age: 0,
    beautiful: false,
    competence,
    stress: 0,
    lastBirth: -9999,
    generation,
    // Individual lifespan varies ±15% so deaths don't come in cohorts.
    lifespan: Math.max(120, lifespan * (1 + rng.gaussian() * 0.15)),
  };
}

// ---- project ---------------------------------------------------------------

export const universe25: ProjectSpec<Universe25State> = {
  id: 'universe25',
  name: 'Universe 25 — Mouse Utopia',
  kind: 'agent',
  description: "Calhoun's behavioral-sink experiment: paradise, then collapse.",
  notes:
    'Four breeding pairs in an enclosure with unlimited food, water, and nesting ' +
    'space; no predators or disease. Population explodes, then social structure ' +
    'collapses: mothers neglect young, males split into violent aggressors and ' +
    'withdrawn "beautiful ones" who never mate, births cease, and the colony ' +
    'dies out. The collapse here is emergent from local crowding rules, not ' +
    'scripted. Blue = male, pink = female, white = "beautiful one", green = pup.',

  parameters: [
    { key: 'initialPairs', label: 'Initial breeding pairs', type: 'int', default: 4, min: 1, max: 32, step: 1, reinitOnChange: true },
    { key: 'arena', label: 'Enclosure size', type: 'int', default: 260, min: 80, max: 500, step: 10, reinitOnChange: true, help: 'Side of the square pen. Space is the only limited resource.' },
    { key: 'lifespan', label: 'Mean lifespan (days)', type: 'int', default: 700, min: 200, max: 1200, step: 10 },
    { key: 'crowdRadius', label: 'Social radius', type: 'range', default: 10, min: 3, max: 30, step: 1, help: 'Distance within which other mice count as crowding.' },
    { key: 'crowdTolerance', label: 'Crowd tolerance', type: 'int', default: 7, min: 1, max: 40, step: 1, help: 'Neighbours a mouse tolerates before stress accrues.' },
    { key: 'fertility', label: 'Base fertility', type: 'range', default: 0.06, min: 0, max: 0.2, step: 0.005, help: 'Daily conception chance for an unstressed fertile female.' },
    { key: 'sinkStrength', label: 'Behavioral-sink strength', type: 'range', default: 1, min: 0, max: 3, step: 0.05, help: 'How sharply crowding suppresses fertility and dooms the colony.' },
  ],

  stats: [
    { key: 'population', label: 'Population', color: '#e2e8f0' },
    { key: 'females', label: 'Fertile females', color: '#f472b6' },
    { key: 'beautiful', label: 'Beautiful ones', color: '#a5f3fc' },
    { key: 'births', label: 'Births/day', color: '#7ee787' },
    { key: 'deaths', label: 'Deaths/day', color: '#ef476f' },
  ],

  createInitialState(params, rng): Universe25State {
    const arena = num(params, 'arena');
    const pairs = num(params, 'initialPairs');
    const lifespan = num(params, 'lifespan');
    const mice: Mouse[] = [];
    let id = 0;
    for (let i = 0; i < pairs; i++) {
      const cx = arena / 2 + rng.range(-arena / 6, arena / 6);
      const cy = arena / 2 + rng.range(-arena / 6, arena / 6);
      // Founders are fully competent — the healthy stock the utopia begins with.
      const male = makeMouse(id++, cx, cy, 'M', 0, rng, lifespan, 1);
      const female = makeMouse(id++, cx + rng.range(-3, 3), cy + rng.range(-3, 3), 'F', 0, rng, lifespan, 1);
      // Founders start as young adults so breeding begins promptly.
      male.age = 60;
      female.age = 60;
      mice.push(male, female);
    }
    return {
      mice,
      arena,
      nextId: id,
      generationOfPeak: 0,
      peak: mice.length,
      phase: 'A · Strive',
      birthsToday: 0,
      deathsToday: 0,
      lastConception: 0,
    };
  },

  step(state, params, rng, tick): Universe25State {
    const arena = state.arena;
    const radius = num(params, 'crowdRadius');
    const tolerance = num(params, 'crowdTolerance');
    const baseFertility = num(params, 'fertility');
    const sink = num(params, 'sinkStrength');
    const lifespan = num(params, 'lifespan');

    const breedStart = 45; // days
    const breedEnd = 460; // female fertility ends (days)
    const birthInterval = 30; // min days between litters

    // Build the spatial index for this tick.
    const hash = new SpatialHash(arena, radius);
    for (const m of state.mice) hash.insert(m);

    const survivors: Mouse[] = [];
    const newborns: Mouse[] = [];
    let births = 0;
    let deaths = 0;

    for (const m of state.mice) {
      m.age += 1;

      // --- local crowding & stress -------------------------------------
      const neighbours = hash.countNear(m.x, m.y, radius, m.id);
      const excess = Math.max(0, neighbours - tolerance);
      // Stress integrates crowding over time, relaxing slightly when uncrowded.
      m.stress += excess * 0.05 - 0.02;
      if (m.stress < 0) m.stress = 0;

      // --- movement: wander with mild social attraction (clustering) ----
      // Calhoun observed mice pooling together despite ample empty space.
      m.vx += rng.range(-0.5, 0.5);
      m.vy += rng.range(-0.5, 0.5);
      // gentle pull toward centre of mass of nearby mice via velocity damping
      const speed = Math.hypot(m.vx, m.vy) || 1;
      const maxSpeed = 1.5;
      if (speed > maxSpeed) {
        m.vx = (m.vx / speed) * maxSpeed;
        m.vy = (m.vy / speed) * maxSpeed;
      }
      m.x += m.vx;
      m.y += m.vy;
      // Reflect off enclosure walls.
      if (m.x < 0) { m.x = 0; m.vx = -m.vx; }
      if (m.y < 0) { m.y = 0; m.vy = -m.vy; }
      if (m.x > arena) { m.x = arena; m.vx = -m.vx; }
      if (m.y > arena) { m.y = arena; m.vy = -m.vy; }

      // --- maturation into a "beautiful one" ----------------------------
      // Checked once, near maturity. A male withdraws mainly because he was
      // reared without competence (the ratchet), and secondarily because he
      // matures into a crowded present. Low-competence males almost always
      // withdraw regardless of current density — which is why the colony
      // cannot re-establish breeding once competence has decayed.
      if (m.sex === 'M' && !m.beautiful && m.age >= breedStart && m.age <= breedStart + 3) {
        const crowdPressure = (neighbours / Math.max(1, tolerance)) * sink;
        const incompetence = 1 - m.competence;
        const pWithdraw = 1 - Math.exp(-(1.4 * incompetence + 0.25 * Math.max(0, crowdPressure - 1)));
        if (rng.chance(pWithdraw)) m.beautiful = true;
      }

      // --- mortality ----------------------------------------------------
      // Old age (individual lifespan), plus density-driven violence for the
      // socially engaged. Beautiful ones avoid conflict and live longer.
      let dailyDeath = 0;
      if (m.age > m.lifespan) dailyDeath += 0.5;
      if (!m.beautiful) {
        dailyDeath += (excess * 0.0006 + m.stress * 0.0004) * sink;
      }
      if (rng.chance(dailyDeath)) {
        deaths++;
        continue; // dies, not pushed to survivors
      }

      // --- reproduction (females) --------------------------------------
      if (
        m.sex === 'F' &&
        m.age >= breedStart &&
        m.age <= breedEnd &&
        tick - m.lastBirth >= birthInterval
      ) {
        // Need a viable, socially competent (non-beautiful) adult male nearby
        // to conceive. As competence decays across generations, such males
        // vanish and conception fails even where space has reopened.
        const mate = hash.findNear(
          m.x,
          m.y,
          radius,
          m.id,
          (o) => o.sex === 'M' && !o.beautiful && o.competence > 0.3 && o.age >= breedStart,
        );
        if (mate) {
          // Fertility falls with crowding AND with the mother's own competence:
          // a poorly-reared female breeds rarely even in an empty pen.
          const overcrowd = Math.max(0, neighbours - tolerance);
          const fertility = baseFertility * m.competence * Math.exp(-sink * overcrowd * 0.12);
          if (rng.chance(fertility)) {
            m.lastBirth = tick;
            state.lastConception = tick;
            // Pups inherit a competence DEGRADED by the crowding they're reared
            // in, and can never exceed their mother's. This is the irreversible
            // ratchet: the sink imprints on each new generation permanently.
            const degrade = 1 - Math.exp(-sink * overcrowd * 0.05);
            const pupCompetence = Math.max(0, Math.min(1, m.competence * (1 - degrade)));
            // Maternal neglect kills pups: worse for low-competence mothers and
            // under crowding, independent of each other.
            const neglect = Math.min(
              0.95,
              (1 - m.competence) * 0.6 + (1 - Math.exp(-sink * overcrowd * 0.08)) * 0.6,
            );
            const litter = rng.int(2, 5);
            for (let k = 0; k < litter; k++) {
              if (rng.chance(neglect)) {
                deaths++; // pup dies of neglect
                continue;
              }
              const pup = makeMouse(
                state.nextId++,
                m.x + rng.range(-2, 2),
                m.y + rng.range(-2, 2),
                rng.chance(0.5) ? 'M' : 'F',
                m.generation + 1,
                rng,
                lifespan,
                pupCompetence,
              );
              newborns.push(pup);
              births++;
            }
          }
        }
      }

      survivors.push(m);
    }

    for (const p of newborns) survivors.push(p);
    state.mice = survivors;
    state.birthsToday = births;
    state.deathsToday = deaths;

    if (survivors.length > state.peak) {
      state.peak = survivors.length;
      state.generationOfPeak = Math.max(...survivors.map((m) => m.generation));
    }

    state.phase = derivePhase(state, tick);
    return state;
  },

  isFinished(state): boolean {
    return state.mice.length === 0;
  },

  render(ctx, state, viewport, params): void {
    const arena = state.arena;
    const scale = Math.min(viewport.width, viewport.height) / arena;
    const ox = (viewport.width - arena * scale) / 2;
    const oy = (viewport.height - arena * scale) / 2;

    // Enclosure.
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.fillStyle = '#11161f';
    ctx.fillRect(ox, oy, arena * scale, arena * scale);
    ctx.strokeStyle = '#263041';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, arena * scale, arena * scale);

    const r = Math.max(1.1, scale * 1.1);
    for (const m of state.mice) {
      const px = ox + m.x * scale;
      const py = oy + m.y * scale;
      let color: string;
      let radius = r;
      if (m.age < 45) {
        color = '#7ee787'; // pup
        radius = r * 0.7;
      } else if (m.beautiful) {
        color = '#e6f6ff'; // beautiful one
      } else if (m.sex === 'M') {
        color = '#4aa3ff';
      } else {
        color = '#f472b6';
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD.
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Phase ${state.phase}`, ox + 8, oy + 8);
    ctx.fillText(`Population ${state.mice.length}  ·  Peak ${state.peak}`, ox + 8, oy + 26);
    void params;
  },

  sample(state, params): Record<string, number> {
    let females = 0;
    let beautiful = 0;
    for (const m of state.mice) {
      if (m.beautiful) beautiful++;
      if (m.sex === 'F' && m.age >= 45 && m.age <= 460) females++;
    }
    void params;
    return {
      population: state.mice.length,
      females,
      beautiful,
      births: state.birthsToday,
      deaths: state.deathsToday,
    };
  },
};

/** Classify the colony's current phase from its trajectory. */
function derivePhase(state: Universe25State, tick: number): Phase {
  const pop = state.mice.length;
  if (pop === 0) return 'Extinct';

  let beautiful = 0;
  const anyBirthRecently = tick - state.lastConception < 60;
  for (const m of state.mice) if (m.beautiful) beautiful++;
  const beautifulFrac = beautiful / pop;

  const pastPeak = pop < state.peak * 0.75 && state.peak > 50;

  if (!anyBirthRecently && pastPeak) return 'D · Death';
  if (pop < state.peak * 0.6 && state.peak > 50) return 'D · Death';
  if (beautifulFrac > 0.15 || (state.birthsToday === 0 && tick - state.lastConception > 40 && state.peak > 50)) {
    return 'C · Stagnation';
  }
  if (state.birthsToday > 0 && pop > 8) return 'B · Exploit';
  return 'A · Strive';
}
