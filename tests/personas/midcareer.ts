import type { Persona } from './types'
import { account, primary, scenario, spouse, ssAuto, ssKnown, ssNone } from './build'

/**
 * Ages 45–54. Roughly 17% of US households.
 *
 * This is where scenarios stop being simple. Careers have forked, some people
 * have three orphaned 401(k)s from old jobs, divorces have split assets, and a
 * meaningful share are supporting both a parent and a college student at once.
 * It is also the last cohort where changing behavior still moves the outcome a
 * lot, which makes accuracy here worth more than it is at either end.
 */
export const midcareer: Persona[] = [
  {
    id: 'median-household-48',
    narrative:
      'Married, one kid left at home, combined income a bit above median. Balance is close to the national median for this age. No pension, no plan, vaguely worried.',
    weight: 0.025,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [
        primary({ age: 48, salary: 72_000, retireAge: 67 }),
        spouse({ age: 47, salary: 44_000, retireAge: 67 }),
      ],
      accounts: [
        account('pretax', 118_000, { contribution: 5_800, employerMatch: 2_160 }),
        account('roth', 14_000),
      ],
      expenses: [
        { label: 'Mortgage', annual: 24_000, startAge: 48, endAge: 63, inflationAdjusted: false },
      ],
      spending: 88_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'expenses',
    ],
  },
  {
    id: 'sandwich-generation-49',
    narrative:
      'Paying part of her mother’s assisted living while the first of two kids starts college. Saving has been flat for four years and she knows it.',
    weight: 0.012,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [
        primary({ age: 49, salary: 104_000, retireAge: 67 }),
        spouse({ age: 51, salary: 67_000, retireAge: 67 }),
      ],
      accounts: [account('pretax', 186_000, { contribution: 6_000, employerMatch: 3_120 })],
      expenses: [
        { label: 'Parent care', annual: 22_000, startAge: 49, endAge: 55, inflationAdjusted: true },
        { label: 'College', annual: 32_000, startAge: 49, endAge: 57, inflationAdjusted: true },
      ],
      spending: 96_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'expenses',
    ],
  },
  {
    id: 'corporate-exec-52',
    narrative:
      'VP at a public company. Large 401(k), deferred comp, and a pile of RSUs that vest over four years. Thinks about retiring at 58 but has never modeled it.',
    weight: 0.015,
    tier: 2,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 52, salary: 310_000, retireAge: 58, ss: ssKnown(4_020, 67) }),
        spouse({ age: 50, salary: 0, retireAge: 58, ss: ssAuto(67, 12) }),
      ],
      accounts: [
        account('pretax', 1_180_000, { contribution: 31_000, employerMatch: 14_000 }),
        account('taxable', 640_000, { contribution: 90_000, costBasis: 410_000 }),
        account('roth', 96_000),
        account('hsa', 62_000, { contribution: 8_550 }),
      ],
      incomes: [
        {
          label: 'RSU vesting',
          annual: 120_000,
          startAge: 52,
          endAge: 56,
          inflationAdjusted: false,
          taxable: true,
        },
      ],
      spending: 210_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'primary.ss.monthlyAtFRA',
      'spouse.currentAge',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
      'accounts.roth.balance',
      'spending.annual',
      'incomes',
    ],
    knownGaps: [
      'Deferred compensation with its own distribution schedule is not modeled',
      'Concentrated single-stock risk in RSUs is treated as diversified',
    ],
  },
  {
    id: 'divorced-restart-47',
    narrative:
      'Divorce two years ago split the 401(k) down the middle via QDRO. Renting now, rebuilding, and the number she is starting from feels like a punch.',
    weight: 0.012,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 47, salary: 86_000, retireAge: 67 })],
      accounts: [
        account('pretax', 92_000, { contribution: 8_600, employerMatch: 2_580 }),
        account('roth', 11_000, { contribution: 7_000 }),
      ],
      spending: 64_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'accounts.pretax.balance',
      'accounts.pretax.contribution',
      'accounts.roth.balance',
    ],
  },
  {
    id: 'job-hopper-51',
    narrative:
      'Five employers in twenty years and a 401(k) left at three of them. Has a rough idea of the total but would have to log into four sites to be sure.',
    weight: 0.012,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 51, salary: 138_000, retireAge: 65 })],
      accounts: [
        account('pretax', 264_000, { contribution: 19_000, employerMatch: 6_900 }),
        account('roth', 38_000),
        account('taxable', 47_000, { costBasis: 39_000 }),
      ],
      spending: 92_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'primary.retireAge'],
    knownGaps: [
      'Cannot state balances without looking them up — the single most common reason people abandon a retirement calculator',
    ],
  },
  {
    id: 'union-trades-50',
    narrative:
      'Journeyman electrician, thirty years in the local. Defined-benefit pension plus an annuity fund. Plans to pull the pin at 62.',
    weight: 0.015,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 50, salary: 98_000, retireAge: 62, ss: ssAuto(62) })],
      accounts: [account('pretax', 132_000, { contribution: 7_000 })],
      pensions: [
        {
          label: 'IBEW pension',
          owner: 'primary',
          annual: 46_000,
          startAge: 62,
          cola: false,
          survivorFraction: 0.5,
        },
      ],
      spending: 74_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'pensions',
      'accounts.pretax.balance',
    ],
  },
  {
    id: 'rental-investor-48',
    narrative:
      'Three single-family rentals bought over fifteen years, two nearly paid off. Treats the rent as the pension and keeps the 401(k) small.',
    weight: 0.012,
    tier: 2,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 48, salary: 88_000, retireAge: 58 }),
        spouse({ age: 46, salary: 52_000, retireAge: 58 }),
      ],
      accounts: [account('pretax', 145_000, { contribution: 9_000 })],
      incomes: [
        {
          label: 'Rental income, net',
          annual: 42_000,
          startAge: 48,
          inflationAdjusted: true,
          taxable: true,
        },
        {
          label: 'Rental income after payoff',
          annual: 19_000,
          startAge: 56,
          inflationAdjusted: true,
          taxable: true,
        },
      ],
      spending: 96_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'incomes',
      'accounts.pretax.balance',
    ],
    knownGaps: [
      'Property equity, depreciation recapture, and vacancy risk are not modeled — only net cash flow',
    ],
  },
  {
    id: 'disability-onset-46',
    narrative:
      'A back injury ended a warehouse career at 44. On SSDI now, which converts to retirement benefits at FRA. The 401(k) has been frozen since.',
    weight: 0.012,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 46, salary: 0, retireAge: 44, ss: ssKnown(1_640, 67) })],
      accounts: [account('pretax', 54_000)],
      incomes: [
        {
          label: 'SSDI',
          annual: 19_700,
          startAge: 46,
          endAge: 66,
          inflationAdjusted: true,
          taxable: true,
        },
      ],
      spending: 34_000,
    }),
    knows: [
      'primary.currentAge',
      'accounts.pretax.balance',
      'incomes',
      'spending.annual',
    ],
  },
  {
    id: 'caregiver-gap-53',
    narrative:
      'Left a good job at 51 to care for a spouse through cancer treatment. Going back part-time now. Three years of no contributions and no Social Security credits.',
    weight: 0.01,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [
        primary({ age: 53, salary: 34_000, retireAge: 67, ss: ssAuto(67, 28) }),
        spouse({ age: 55, salary: 71_000, retireAge: 67 }),
      ],
      accounts: [account('pretax', 208_000, { contribution: 3_000 })],
      spending: 78_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
    ],
  },
  {
    id: 'inheritance-50',
    narrative:
      'Received $400k from a parent’s estate last year, mostly in a brokerage account with stepped-up basis. Has no idea whether it changes the retirement date.',
    weight: 0.008,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 50, salary: 94_000, retireAge: 60 }),
        spouse({ age: 52, salary: 61_000, retireAge: 62, ss: ssNone }),
      ],
      accounts: [
        account('pretax', 176_000, { contribution: 12_000, employerMatch: 3_760 }),
        account('taxable', 400_000, { costBasis: 400_000 }),
      ],
      spending: 82_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
    ],
  },
  {
    id: 'restaurant-manager-46',
    narrative:
      'Assistant manager at a chain restaurant, married to a warehouse picker. Neither job has ever offered a retirement plan. The household keeps about $3,000 as an emergency cushion and nothing else.',
    weight: 0.045,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [
        primary({ age: 46, salary: 41_000, retireAge: 67 }),
        spouse({ age: 44, salary: 37_000, retireAge: 67 }),
      ],
      accounts: [],
      spending: 58_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'spouse.currentAge', 'spouse.salary'],
  },
]
