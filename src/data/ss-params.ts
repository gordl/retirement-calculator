/**
 * Social Security parameters, 2025.
 *
 * These are stated in 2025 dollars and the engine works in real terms, so they
 * do not need annual indexing to stay approximately right — the bend points and
 * wage base are wage-indexed, which tracks real wage growth closely enough for
 * a planning tool. They should still be refreshed every few years.
 *
 * Source: SSA published bend points, wage base, and FRA schedule.
 */

/** Maximum earnings subject to Social Security tax, and thus counted toward AIME. */
export const WAGE_BASE = 176_100

/**
 * PIA formula bend points, monthly. The benefit replaces 90% of the first
 * slice of averaged monthly earnings, 32% of the next, and 15% above that.
 *
 * This steep progressivity is the single most important fact about Social
 * Security for this tool: a low earner gets back a far larger share of their
 * earnings than a high earner. Any model that treats the benefit as a flat
 * percentage of income will badly misjudge both ends of the population.
 */
export const BEND_POINTS = { first: 1_226, second: 7_391 } as const
export const REPLACEMENT_RATES = { tier1: 0.9, tier2: 0.32, tier3: 0.15 } as const

/** Years of earnings averaged into AIME. Missing years count as zero. */
export const AIME_YEARS = 35

/** Full retirement age for anyone born 1960 or later. */
export const FULL_RETIREMENT_AGE = 67

export const MIN_CLAIM_AGE = 62
export const MAX_CLAIM_AGE = 70

/**
 * Early-claiming reduction: 5/9 of 1% per month for the first 36 months before
 * FRA, then 5/12 of 1% per month beyond that.
 */
export const EARLY_REDUCTION_PER_MONTH_FIRST_36 = 5 / 9 / 100
export const EARLY_REDUCTION_PER_MONTH_BEYOND = 5 / 12 / 100

/** Delayed retirement credits: 8% per year from FRA to 70. */
export const DELAYED_CREDIT_PER_YEAR = 0.08

/** Credits needed to qualify for a retirement benefit at all. */
export const CREDITS_REQUIRED = 40
