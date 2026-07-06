/**
 * Deterministic, seedable pseudo-random number generator.
 *
 * Reproducibility is essential for a scientific-ish tool: the same seed must
 * reproduce the same run exactly, so results can be compared and shared.
 * `Math.random` gives us neither seeding nor determinism, so we use a small,
 * fast, well-distributed generator (mulberry32 driven by a splitmix32 seed).
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** True with the given probability p (0..1). */
  chance(p: number): boolean;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Standard-normal sample (mean 0, sd 1), via Box–Muller. */
  gaussian(): number;
}

/** Hash a string seed into a 32-bit integer (splitmix32 finaliser style). */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: string | number): Rng {
  let a = hashSeed(seed) || 1;

  // mulberry32
  const nextFloat = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare: number | null = null;

  return {
    next: nextFloat,
    int: (min, max) => min + Math.floor(nextFloat() * (max - min + 1)),
    range: (min, max) => min + nextFloat() * (max - min),
    chance: (p) => nextFloat() < p,
    pick: (items) => items[Math.floor(nextFloat() * items.length)],
    gaussian() {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      // Box–Muller
      let u = 0;
      let v = 0;
      while (u === 0) u = nextFloat();
      while (v === 0) v = nextFloat();
      const mag = Math.sqrt(-2 * Math.log(u));
      spare = mag * Math.sin(2 * Math.PI * v);
      return mag * Math.cos(2 * Math.PI * v);
    },
  };
}
