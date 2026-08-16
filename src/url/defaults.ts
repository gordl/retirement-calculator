import type { Assumptions } from '../engine/types'

/**
 * The single source of truth for "what we assume when you don't say."
 *
 * Two things depend on this file agreeing with itself: the URL codec omits a
 * field from the query string exactly when it equals its default here, and
 * the UI pre-fills exactly these values. If they ever diverge, a shared link
 * would silently show its recipient different numbers than its sender saw —
 * which is the one bug this project cannot afford.
 */

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  inflation: 0.025,
  realReturn: 0.05,
  stockAllocation: 0.6,
  effectiveTaxRate: 0.15,
  withdrawalOrder: ['taxable', 'pretax', 'roth', 'hsa'],
}

export const DEFAULT_RETIRE_AGE = 65
export const DEFAULT_PLAN_TO_AGE = 92
export const DEFAULT_SALARY_GROWTH = 0.005
export const DEFAULT_SS_CLAIM_AGE = 67
