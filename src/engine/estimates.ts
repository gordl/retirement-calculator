import type { Scenario } from './types'

/**
 * Estimators for fields most households can't state off the top of their
 * head — spending being the biggest one (see personas.test.ts: only ~39% of
 * the weighted population knows their retirement spending target).
 *
 * These are shared between the UI (as the pre-filled default) and the
 * sensitivity harness (as the value substituted when "defaulting" a field),
 * so the two always agree on what "not knowing this field" looks like.
 */

/**
 * A first-pass spending target when the household hasn't stated one: roughly
 * 75% of current gross working income, the conventional rule-of-thumb
 * replacement rate. Households with no working income (already retired, or
 * not yet earning) fall back to a flat figure near the population median
 * observed in the persona library.
 */
export function estimateSpending(scenario: Scenario): number {
  const workingIncome = scenario.people
    .filter((p) => p.currentAge < p.retireAge)
    .reduce((sum, p) => sum + p.salary, 0)

  if (workingIncome > 0) return Math.round((workingIncome * 0.75) / 1000) * 1000
  return 45_000
}
