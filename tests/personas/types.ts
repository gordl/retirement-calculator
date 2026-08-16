import type { Scenario } from '../../src/engine/types'

/**
 * Every input the tool could conceivably ask for, as a flat vocabulary.
 *
 * This list is load-bearing in three places, which is why it's a closed union
 * rather than free-form strings:
 *
 *  - the friction harness walks it in UI order, counting fields to a stable answer
 *  - the sensitivity analysis scores each entry's information value
 *  - each persona's `knows` set is drawn from it
 *
 * Adding a field here without justifying it against the sensitivity ranking is
 * how a fast tool slowly becomes a slow one.
 */
export type FieldPath =
  // Primary person
  | 'primary.currentAge'
  | 'primary.retireAge'
  | 'primary.planToAge'
  | 'primary.salary'
  | 'primary.ss.claimAge'
  | 'primary.ss.monthlyAtFRA'
  // Spouse
  | 'spouse.currentAge'
  | 'spouse.retireAge'
  | 'spouse.salary'
  | 'spouse.ss.claimAge'
  | 'spouse.ss.monthlyAtFRA'
  // Spending
  | 'spending.annual'
  | 'spending.path'
  // Accounts
  | 'accounts.pretax.balance'
  | 'accounts.pretax.contribution'
  | 'accounts.pretax.employerMatch'
  | 'accounts.roth.balance'
  | 'accounts.roth.contribution'
  | 'accounts.taxable.balance'
  | 'accounts.taxable.contribution'
  | 'accounts.hsa.balance'
  | 'accounts.hsa.contribution'
  // Streams
  | 'pensions'
  | 'incomes'
  | 'expenses'
  | 'lumpSums'
  // Assumptions
  | 'assumptions.realReturn'
  | 'assumptions.inflation'
  | 'assumptions.stockAllocation'
  | 'assumptions.effectiveTaxRate'
  | 'assumptions.withdrawalOrder'

/**
 * What this household actually came to find out. The tool should be able to
 * answer all three, but they need different amounts of information: "am I on
 * track" tolerates far rougher inputs than "how much can I spend".
 */
export type Question =
  | 'can-i-retire-at' // I have a date in mind. Does it work?
  | 'am-i-on-track' // I'm years out. Am I saving enough?
  | 'how-much-can-i-spend' // I'm retiring. What's my number?
  | 'will-my-money-last' // Already retired. Am I going to be okay?

/**
 * Tier 1 households must be expressible losslessly — they represent the bulk of
 * the population by weight. Tier 2 are deliberately at or past the edge of the
 * model; their coverage gaps are a prioritized backlog, not a build failure.
 */
export type Tier = 1 | 2

export interface Persona {
  id: string
  /** One or two sentences in plain language. Should read like a real person. */
  narrative: string
  /**
   * Share of US households this persona stands in for, per SCF/Census
   * distributions. The set sums to ~1.0. Weighting matters: an unweighted mean
   * over these personas over-represents wealthy, complicated households, which
   * is precisely the bias that makes retirement tools slow for everyone else.
   */
  weight: number
  tier: Tier
  question: Question
  /**
   * The household's real situation, fully specified. This is ground truth, not
   * what they'd type in — the gap between this and `knows` is the whole point.
   */
  truth: Scenario
  /**
   * Fields this person can answer off the top of their head, without looking
   * anything up or calling anyone.
   *
   * This is what separates "the form is short" from "the form is answerable".
   * A three-field form is not fast if one field is your cost basis.
   */
  knows: FieldPath[]
  /**
   * Facts about this household the model cannot currently represent. Populated
   * by hand when a persona is written, verified by the expressibility test.
   */
  knownGaps?: string[]
}
