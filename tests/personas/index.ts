import type { FieldPath, Persona } from './types'
import { accumulating } from './accumulating'
import { midcareer } from './midcareer'
import { preretirement } from './preretirement'
import { retired } from './retired'
import { edge } from './edge'

export type { Persona, FieldPath, Question, Tier } from './types'

/** Raw personas, weights as authored. */
export const PERSONAS: Persona[] = [
  ...accumulating,
  ...midcareer,
  ...preretirement,
  ...retired,
  ...edge,
]

const rawWeightSum = PERSONAS.reduce((sum, p) => sum + p.weight, 0)

/**
 * Weights normalized to sum to exactly 1, so downstream code can treat them as
 * probabilities without each call site re-normalizing. Authored weights are
 * approximate by design — they're read off published distributions and will
 * never sum to 1.0000 on their own.
 */
export const WEIGHTS: ReadonlyMap<string, number> = new Map(
  PERSONAS.map((p) => [p.id, p.weight / rawWeightSum]),
)

export const RAW_WEIGHT_SUM = rawWeightSum

export function weightOf(persona: Persona): number {
  return WEIGHTS.get(persona.id) ?? 0
}

/**
 * Population-weighted mean of some per-persona measurement. This is the right
 * way to aggregate almost every metric in this project — an unweighted mean
 * over these personas systematically over-represents the wealthy, complicated
 * households, which is exactly the bias the library exists to correct for.
 */
export function weightedMean(
  personas: Persona[],
  measure: (p: Persona) => number,
): number {
  const totalWeight = personas.reduce((sum, p) => sum + weightOf(p), 0)
  if (totalWeight === 0) return 0
  return personas.reduce((sum, p) => sum + weightOf(p) * measure(p), 0) / totalWeight
}

/**
 * Population-weighted percentile. Personas are sorted by the measured value,
 * then we walk the cumulative weight until we cross the target quantile.
 *
 * Used for the friction budgets, where "p50 fields to an answer" has to mean
 * the median *household*, not the median persona file.
 */
export function weightedPercentile(
  personas: Persona[],
  measure: (p: Persona) => number,
  quantile: number,
): number {
  if (personas.length === 0) return 0

  const sorted = personas
    .map((p) => ({ value: measure(p), weight: weightOf(p) }))
    .sort((a, b) => a.value - b.value)

  const totalWeight = sorted.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight === 0) return sorted[sorted.length - 1]!.value

  const target = quantile * totalWeight
  let cumulative = 0
  for (const entry of sorted) {
    cumulative += entry.weight
    if (cumulative >= target) return entry.value
  }
  return sorted[sorted.length - 1]!.value
}

export const tier1 = (): Persona[] => PERSONAS.filter((p) => p.tier === 1)
export const tier2 = (): Persona[] => PERSONAS.filter((p) => p.tier === 2)

export function personaById(id: string): Persona {
  const found = PERSONAS.find((p) => p.id === id)
  if (!found) throw new Error(`no persona with id "${id}"`)
  return found
}

/** Every field at least one persona can answer. Useful for sanity checks. */
export function fieldsAnyoneKnows(): Set<FieldPath> {
  const known = new Set<FieldPath>()
  for (const p of PERSONAS) for (const f of p.knows) known.add(f)
  return known
}
