import type { Age, Dollars, Person } from './types'
import {
  AIME_YEARS,
  BEND_POINTS,
  DELAYED_CREDIT_PER_YEAR,
  EARLY_REDUCTION_PER_MONTH_BEYOND,
  EARLY_REDUCTION_PER_MONTH_FIRST_36,
  FULL_RETIREMENT_AGE,
  MAX_CLAIM_AGE,
  MIN_CLAIM_AGE,
  REPLACEMENT_RATES,
  WAGE_BASE,
} from '../data/ss-params'

/**
 * Social Security estimation.
 *
 * The design goal here is to never make the user leave the page. Most people
 * do not know their benefit, and "go look it up at ssa.gov and come back" is
 * where a large share of retirement-calculator sessions end. So we estimate it
 * from what they do know — roughly what they earn and roughly how long they've
 * worked — and let anyone who knows the real figure override it.
 *
 * The estimate assumes flat real career earnings at the current salary. That is
 * wrong in a specific and known direction: people generally earn less early in
 * their careers, so this overstates the benefit somewhat for high earners late
 * in their careers. The error is a few percent of one income component, which
 * is small next to the uncertainty in market returns, and far smaller than the
 * error from a user who abandons the tool and never gets an answer at all.
 */

/**
 * Average Indexed Monthly Earnings.
 *
 * Earnings above the wage base don't count, and fewer than 35 working years
 * means the missing years are averaged in as zeros — which is why a 20-year
 * career produces a much smaller benefit than intuition suggests.
 */
export function estimateAIME(salary: Dollars, yearsWorked: number): Dollars {
  const cappedSalary = Math.min(Math.max(salary, 0), WAGE_BASE)
  const creditedYears = Math.min(Math.max(yearsWorked, 0), AIME_YEARS)
  return (cappedSalary * (creditedYears / AIME_YEARS)) / 12
}

/**
 * Primary Insurance Amount — the monthly benefit at full retirement age.
 * Applies the three-tier progressive replacement formula to AIME.
 */
export function piaFromAIME(aime: Dollars): Dollars {
  const tier1 = Math.min(aime, BEND_POINTS.first)
  const tier2 = Math.min(Math.max(aime - BEND_POINTS.first, 0), BEND_POINTS.second - BEND_POINTS.first)
  const tier3 = Math.max(aime - BEND_POINTS.second, 0)

  return (
    tier1 * REPLACEMENT_RATES.tier1 +
    tier2 * REPLACEMENT_RATES.tier2 +
    tier3 * REPLACEMENT_RATES.tier3
  )
}

/**
 * Adjust a full-retirement-age benefit for claiming early or late.
 *
 * Claiming at 62 costs about 30% permanently; waiting to 70 adds about 24%.
 * That spread is one of the largest single levers an individual controls, which
 * is why claim age earns a place in the input flow when most fields don't.
 */
export function claimAdjustment(claimAge: Age, fra: Age = FULL_RETIREMENT_AGE): number {
  const bounded = Math.min(Math.max(claimAge, MIN_CLAIM_AGE), MAX_CLAIM_AGE)

  if (bounded === fra) return 1

  if (bounded < fra) {
    const monthsEarly = (fra - bounded) * 12
    const first36 = Math.min(monthsEarly, 36)
    const beyond = Math.max(monthsEarly - 36, 0)
    return (
      1 - first36 * EARLY_REDUCTION_PER_MONTH_FIRST_36 - beyond * EARLY_REDUCTION_PER_MONTH_BEYOND
    )
  }

  return 1 + (bounded - fra) * DELAYED_CREDIT_PER_YEAR
}

/** Years worked assumed when the user hasn't said. Full career from age 22. */
function assumedYearsWorked(person: Person): number {
  const workingUntil = Math.max(person.retireAge, person.currentAge)
  return Math.max(0, Math.min(workingUntil, 67) - 22)
}

/**
 * Annual Social Security benefit for a person, in today's dollars, once they
 * have claimed. Returns 0 before their claim age and for those with no benefit.
 */
export function annualBenefit(person: Person, atAge: Age): Dollars {
  const ss = person.socialSecurity
  if (ss.mode === 'none') return 0
  if (atAge < ss.claimAge) return 0

  const monthlyAtFRA =
    ss.mode === 'manual'
      ? ss.monthlyAtFRA
      : piaFromAIME(estimateAIME(person.salary, ss.yearsWorked ?? assumedYearsWorked(person)))

  return monthlyAtFRA * claimAdjustment(ss.claimAge) * 12
}
