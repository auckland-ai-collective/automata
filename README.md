# Automata

A general-purpose workbench for building, running, and observing **cellular
automata** and **agent-based models**. The same simulation code runs in an
Electron desktop app and standalone on the web.

## Why one engine for two paradigms

Classic cellular automata (Conway's Life, Wireworld) are a *grid of cells*
updated from their neighbours. Calhoun's **Universe 25** is an *agent-based
model* — individual mice with identity, age, sex, and social behaviour moving
through space. They look different but share a driver: build initial state,
`step` it forward one tick, `render` it, `sample` some numbers.

So a **project** is a self-contained [`ProjectSpec`](src/core/types.ts) that owns
its own `State` type. The [`Engine`](src/core/engine.ts) is generic over that
state and knows nothing about grids vs. agents — which is exactly what lets both
paradigms share one workbench.

```
src/
  core/         framework-agnostic engine (no DOM except the canvas context)
    types.ts    the ProjectSpec contract every simulation implements
    engine.ts   tick loop, seeded RNG, stat history, lifecycle events
    rng.ts      deterministic seedable PRNG (reproducible runs)
    grid.ts     grid + neighbour helpers for cellular automata
  projects/     one folder per simulation
    conway/     Conway's Game of Life        (grid CA)
    wireworld/  Wireworld electron loop       (grid CA)
    universe25/ Calhoun's mouse utopia        (agent-based)
    registry.ts the list of available projects
  ui/           React control panel + canvas + live charts
  standalone.ts run a single project on a bare page, no framework
```

## The flagship: Universe 25

Four breeding pairs of mice in an enclosure with unlimited food, water, and
nesting space; no predators, no disease. The only finite resource is *space*.
The colony grows exponentially, then collapses socially and goes extinct — the
**behavioral sink**. Here that collapse is **emergent** from local crowding
rules, not scripted:

- fertility falls as local density rises,
- pups born into crowding die of maternal neglect,
- males maturing under stress become withdrawn **"beautiful ones"** that never
  mate,
- density stress raises mortality among the socially engaged.

These reproduce Calhoun's four phases: Strive → Exploit → Stagnation → Death.
Every constant is a slider, so you can explore the model, not just replay it.

### Is the collapse spatial or social?

Calhoun's central claim was that the behavioral sink is driven by **social**
crowding, not lack of physical space — the mice voluntarily pile into a few pens
while others sit empty. The **Social pull** parameter models exactly that: how
strongly a mouse steers toward its neighbours (cohesion + short-range
separation, so they pack at finite density instead of collapsing to a point).

Run [`node scripts/experiment-space.mjs`](scripts/experiment-space.mjs) to sweep
enclosure size with pull off vs. on:

- **Social pull = 0** (pure random walk): the outcome depends entirely on space.
  Small pens hit the sink; a big pen supports tens of thousands before crashing;
  a *huge* pen makes the colony **fizzle out** — the mice disperse and can't find
  mates (an Allee effect). Space is the control variable.
- **Social pull > 0** (voluntary aggregation): the colony collapses to extinction
  at **every** enclosure size on nearly the same timeline — from 260 units to
  4000. The mice crowd themselves regardless of empty space. This is Calhoun's
  point, reproduced: **infinite space does not prevent the collapse.**

Curiosity inspired by this post-
https://www.reddit.com/r/cellular_automata/comments/1ungluy/comment/ovpodcm/?context=1

## Adding a project

1. Create `src/projects/<id>/index.ts` exporting a `ProjectSpec`.
2. Add it to [`src/projects/registry.ts`](src/projects/registry.ts).

That's it — it appears in the picker and (being self-contained) can also be run
standalone.

## Develop & build

```bash
npm install

npm run dev            # Vite dev server (web) — http://localhost:5173
npm run build          # type-check + build the web app to dist/
npm run build:electron # build web + bundle the Electron main/preload

# Desktop app (after a build):
npm run electron
```

For the standalone single-automaton page, open `/standalone.html` on the dev
server or in the built `dist/`.

> Note: the dev server is not started for you — run `npm run dev` yourself.

## License

MIT © [Michael Wells](mailto:mike@aaic.nz). See [LICENSE](LICENSE).
