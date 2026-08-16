/**
 * A tiny seeded PRNG (mulberry32) and a standard-normal sampler built on it.
 *
 * Using `Math.random()` anywhere in this project would break the one promise
 * the URL-as-state design makes: that a shared link shows its recipient
 * exactly what the sender saw. Every stochastic draw in the engine must trace
 * back to one of these seeded generators.
 */

export type Rng = () => number

/** mulberry32 — small, fast, good enough statistical quality for this use, and
 *  trivially reproducible across JS engines (no reliance on typed-array timing
 *  or platform-specific Math.random implementations). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal sample via Box-Muller, drawing two uniforms per call. */
export function nextGaussian(rng: Rng): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng() // exclude exactly 0, which would make ln(0)
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
