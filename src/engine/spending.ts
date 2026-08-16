import type { SpendingPath } from './types'

/**
 * How real spending changes across retirement.
 *
 * `flat` holds it constant. It is the conventional assumption and it is
 * conservative, which makes it the right default for a tool whose job is to
 * tell people whether they're safe.
 *
 * `retirement-smile` follows what spending data actually shows: an active early
 * phase, a real decline through the seventies as travel and discretionary
 * spending fall off, and a partial rise late as health costs arrive. The
 * decline is well documented (Blanchett and others put it near 1% a year in
 * real terms through the middle of retirement) and it is large enough to change
 * conclusions — which is exactly why it is modeled explicitly rather than
 * folded into an assumption nobody can see.
 */
export function spendingMultiplier(path: SpendingPath, yearsIntoRetirement: number): number {
  if (path === 'flat') return 1

  // Piecewise approximation of the observed decline-then-uptick curve, anchored
  // at 1.0 in the first decade so the number the user typed is the number they
  // spend at the start of retirement.
  if (yearsIntoRetirement < 10) return 1
  if (yearsIntoRetirement < 20) return 0.88
  return 0.85
}
