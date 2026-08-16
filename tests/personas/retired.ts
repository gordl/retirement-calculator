import type { Persona } from './types'
import { account, primary, scenario, spouse, ssKnown, ssNone } from './build'

/**
 * Ages 65+. Roughly 28% of US households.
 *
 * The defining fact of this cohort: Social Security is the majority of income
 * for most of them, and close to all of it for a large minority. Roughly a
 * third of retirees rely on it for 90% or more. Any tool that treats Social
 * Security as a rounding error on top of a portfolio has already failed the
 * typical American retiree.
 *
 * Their question is also different in kind. They are not asking whether they
 * can retire — that is settled. They are asking whether they are going to be
 * okay, and they want an answer in one screen.
 */
export const retired: Persona[] = [
  {
    id: 'ss-only-71',
    narrative:
      'Retired hotel housekeeper. Social Security is 95% of her income; the remaining 5% is $9k in a credit union account. Represents a very large share of American retirees and almost no retirement calculator’s design target.',
    weight: 0.05,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 71, salary: 0, retireAge: 66, ss: ssKnown(1_580, 66) })],
      accounts: [account('taxable', 9_000, { costBasis: 9_000 })],
      spending: 24_000,
    }),
    knows: ['primary.currentAge', 'primary.ss.monthlyAtFRA', 'spending.annual'],
  },
  {
    id: 'comfortable-retiree-69',
    narrative:
      'Retired three years ago from a utility company. Two Social Security checks, a paid-off house, and a portfolio that has so far gone up. Wants a sanity check, not a plan.',
    weight: 0.05,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [
        primary({ age: 69, salary: 0, retireAge: 66, ss: ssKnown(2_740, 66) }),
        spouse({ age: 68, salary: 0, retireAge: 65, ss: ssKnown(1_420, 66) }),
      ],
      accounts: [
        account('pretax', 540_000),
        account('roth', 62_000),
        account('taxable', 45_000, { costBasis: 38_000 }),
      ],
      spending: { annual: 72_000, path: 'retirement-smile' },
    }),
    knows: [
      'primary.currentAge',
      'spouse.currentAge',
      'primary.ss.monthlyAtFRA',
      'spouse.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'spending.annual',
    ],
  },
  {
    id: 'working-to-70-67',
    narrative:
      'Still consulting two days a week and deliberately delaying Social Security to 70 for the 8%-a-year bump. Wants to confirm the delay is worth it.',
    weight: 0.02,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 67, salary: 52_000, retireAge: 70, ss: ssKnown(3_240, 70) })],
      accounts: [
        account('pretax', 410_000, { contribution: 8_000 }),
        account('roth', 55_000),
      ],
      spending: 58_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'primary.ss.claimAge',
      'primary.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'spending.annual',
    ],
  },
  {
    id: 'rmd-heavy-73',
    narrative:
      'Saved diligently into a 401(k) for forty years and is now being forced to take out more than he wants to spend. The tax bill is the surprise nobody warned him about.',
    weight: 0.022,
    tier: 2,
    question: 'will-my-money-last',
    truth: scenario({
      people: [
        primary({ age: 73, salary: 0, retireAge: 65, ss: ssKnown(3_020, 66) }),
        spouse({ age: 71, salary: 0, retireAge: 63, ss: ssKnown(1_510, 66) }),
      ],
      accounts: [
        account('pretax', 1_120_000),
        account('taxable', 180_000, { costBasis: 120_000 }),
        account('roth', 40_000),
      ],
      spending: 84_000,
      assumptions: { effectiveTaxRate: 0.19, stockAllocation: 0.45 },
    }),
    knows: [
      'primary.currentAge',
      'spouse.currentAge',
      'primary.ss.monthlyAtFRA',
      'spouse.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
      'spending.annual',
    ],
    knownGaps: [
      'Required minimum distributions are not modeled in v1, so forced taxable income is understated for large pre-tax balances',
    ],
  },
  {
    id: 'widow-78',
    narrative:
      'Lost her husband two years ago and with him the smaller of their two Social Security checks — a roughly one-third income drop that arrived alongside the grief. Spending did not fall by nearly as much.',
    weight: 0.035,
    tier: 2,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 78, salary: 0, retireAge: 64, planToAge: 96, ss: ssKnown(2_390, 66) })],
      accounts: [account('pretax', 215_000), account('taxable', 22_000, { costBasis: 22_000 })],
      spending: 46_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'spending.annual',
    ],
    knownGaps: [
      'The survivor transition itself (losing one benefit, filing status change) is not modeled — this persona is entered post-transition',
    ],
  },
  {
    id: 'ltc-need-81',
    narrative:
      'Moved into memory care last year at $9,200 a month. The portfolio that looked ample at 70 has a very different shape at 81.',
    weight: 0.028,
    tier: 2,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 81, salary: 0, retireAge: 67, planToAge: 94, ss: ssKnown(2_180, 66) })],
      accounts: [account('pretax', 430_000), account('taxable', 95_000, { costBasis: 60_000 })],
      expenses: [
        { label: 'Memory care', annual: 110_400, startAge: 81, inflationAdjusted: true },
      ],
      spending: 18_000,
    }),
    knows: ['primary.currentAge', 'primary.ss.monthlyAtFRA', 'accounts.pretax.balance', 'expenses'],
    knownGaps: [
      'Long-term care cost inflation runs well above general inflation and is not separately modeled',
      'Medicaid spend-down as a floor is not modeled',
    ],
  },
  {
    id: 'modest-retiree-75',
    narrative:
      'Retired postal worker. A small pension, Social Security, and $120k in an IRA she is careful not to touch. Owns her home outright.',
    weight: 0.05,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 75, salary: 0, retireAge: 62, ss: ssKnown(1_890, 66) })],
      accounts: [account('pretax', 120_000)],
      pensions: [
        { label: 'USPS pension', owner: 'primary', annual: 22_000, startAge: 62, cola: true },
      ],
      spending: 41_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.ss.monthlyAtFRA',
      'pensions',
      'accounts.pretax.balance',
      'spending.annual',
    ],
  },
  {
    id: 'legacy-minded-72',
    narrative:
      'Comfortable and deliberately underspending so the grandchildren get something. Wants to know how much he could give away now without risking himself.',
    weight: 0.012,
    tier: 1,
    question: 'how-much-can-i-spend',
    truth: scenario({
      people: [
        primary({ age: 72, salary: 0, retireAge: 68, planToAge: 95, ss: ssKnown(3_100, 68) }),
        spouse({ age: 70, salary: 0, retireAge: 66, ss: ssKnown(1_820, 66) }),
      ],
      accounts: [
        account('pretax', 780_000),
        account('roth', 190_000),
        account('taxable', 340_000, { costBasis: 150_000 }),
      ],
      spending: 62_000,
      assumptions: { stockAllocation: 0.55 },
    }),
    knows: [
      'primary.currentAge',
      'spouse.currentAge',
      'primary.ss.monthlyAtFRA',
      'spouse.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'accounts.roth.balance',
      'accounts.taxable.balance',
      'spending.annual',
    ],
    knownGaps: ['No explicit bequest target — legacy goals are expressed only as underspending'],
  },
  {
    id: 'unretired-part-time-68',
    narrative:
      'Retired at 65, got bored and nervous in equal measure, and went back to 20 hours a week at a garden center. The income is small but it changes the math more than he expects.',
    weight: 0.018,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 68, salary: 0, retireAge: 65, ss: ssKnown(2_260, 66) })],
      accounts: [account('pretax', 245_000), account('roth', 30_000)],
      incomes: [
        {
          label: 'Part-time work',
          annual: 17_000,
          startAge: 68,
          endAge: 74,
          inflationAdjusted: true,
          taxable: true,
        },
      ],
      spending: 52_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'incomes',
      'spending.annual',
    ],
  },
  {
    id: 'renter-retiree-70',
    narrative:
      'Never owned a home. Rent is $1,750 and goes up every year, which is the single biggest threat to a plan that otherwise looks survivable.',
    weight: 0.025,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 70, salary: 0, retireAge: 68, ss: ssKnown(1_720, 66) })],
      accounts: [account('pretax', 78_000)],
      expenses: [{ label: 'Rent', annual: 21_000, startAge: 70, inflationAdjusted: true }],
      spending: 22_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'expenses',
      'spending.annual',
    ],
  },
  {
    id: 'no-ss-immigrant-73',
    narrative:
      'Immigrated at 52 and has only 22 Social Security credits — short of the 40 needed to qualify. Supported by savings and by an adult child. A situation most calculators cannot express at all.',
    weight: 0.008,
    tier: 2,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 73, salary: 0, retireAge: 71, ss: ssNone })],
      accounts: [account('taxable', 140_000, { costBasis: 140_000 })],
      incomes: [
        {
          label: 'Family support',
          annual: 18_000,
          startAge: 73,
          inflationAdjusted: true,
          taxable: false,
        },
      ],
      spending: 29_000,
    }),
    knows: ['primary.currentAge', 'accounts.taxable.balance', 'incomes', 'spending.annual'],
  },
]
