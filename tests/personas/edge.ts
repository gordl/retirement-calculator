import type { Persona } from './types'
import { account, primary, scenario, spouse, ssAuto, ssKnown } from './build'

/**
 * Deliberate boundary probes. Tiny population weights — these exist to stress
 * the engine's edges, not to represent anybody in particular.
 *
 * Every one of these is a case where a naive implementation produces something
 * embarrassing: a negative balance, a divide-by-zero, a 100% success rate on a
 * plan that is visibly already broken, or a projection that silently runs for
 * seventy years.
 */
export const edge: Persona[] = [
  {
    id: 'already-depleted-79',
    narrative:
      'Spent through the IRA by 77. Living on Social Security alone now, about $900 a month short of actual expenses, covering the gap with a credit card. The plan is already broken and the tool must say so plainly rather than producing a number.',
    weight: 0.004,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 79, salary: 0, retireAge: 66, ss: ssKnown(1_490, 66) })],
      accounts: [account('taxable', 0, { costBasis: 0 })],
      spending: 29_000,
    }),
    knows: ['primary.currentAge', 'primary.ss.monthlyAtFRA', 'spending.annual'],
  },
  {
    id: 'very-long-horizon-25',
    narrative:
      'Twenty-five, healthy, planning to age 100. A 75-year projection — the longest the tool should ever run, and the one where compounding assumptions dominate everything else.',
    weight: 0.003,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 25, salary: 55_000, retireAge: 67, planToAge: 100 })],
      accounts: [account('pretax', 4_000, { contribution: 2_750, employerMatch: 1_650 })],
      spending: 44_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'primary.planToAge'],
  },
  {
    id: 'all-equity-volatile-40',
    narrative:
      'One hundred percent equities and proud of it. Deterministic and Monte Carlo results should diverge sharply here — if they do not, the volatility modeling is not doing anything.',
    weight: 0.003,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 40, salary: 115_000, retireAge: 60 })],
      accounts: [account('taxable', 380_000, { contribution: 40_000, costBasis: 300_000 })],
      spending: 70_000,
      assumptions: { stockAllocation: 1.0 },
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'accounts.taxable.balance',
      'assumptions.stockAllocation',
    ],
  },
  {
    id: 'retiring-tomorrow-64',
    narrative:
      'Last day of work is in three weeks. Zero accumulation years — the projection is pure drawdown from year one, with no time to recover from a bad first decade.',
    weight: 0.003,
    tier: 1,
    question: 'how-much-can-i-spend',
    truth: scenario({
      people: [
        primary({ age: 64, salary: 91_000, retireAge: 64, ss: ssAuto(65) }),
        spouse({ age: 64, salary: 0, retireAge: 64, ss: ssAuto(65) }),
      ],
      accounts: [account('pretax', 610_000), account('roth', 70_000)],
      spending: 68_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.retireAge',
      'spouse.currentAge',
      'accounts.pretax.balance',
      'accounts.roth.balance',
    ],
  },
  {
    id: 'massively-overfunded-58',
    narrative:
      'Eleven million dollars and spends $140k. Should return a 100% success rate under every model without the arithmetic overflowing or the chart becoming unreadable.',
    weight: 0.002,
    tier: 1,
    question: 'how-much-can-i-spend',
    truth: scenario({
      people: [
        primary({ age: 58, salary: 0, retireAge: 55, planToAge: 95, ss: ssKnown(3_800, 70) }),
        spouse({ age: 56, salary: 0, retireAge: 55, ss: ssKnown(2_100, 70) }),
      ],
      accounts: [
        account('taxable', 7_400_000, { costBasis: 3_100_000 }),
        account('pretax', 3_200_000),
        account('roth', 400_000),
      ],
      spending: 140_000,
      assumptions: { stockAllocation: 0.4, effectiveTaxRate: 0.25 },
    }),
    knows: [
      'primary.currentAge',
      'spouse.currentAge',
      'accounts.taxable.balance',
      'accounts.pretax.balance',
      'spending.annual',
    ],
  },
]
