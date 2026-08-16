import type { Persona } from './types'
import { account, primary, scenario, spouse, ssAuto, ssKnown, ssNone } from './build'

/**
 * Ages 25–44. Roughly 37% of US households.
 *
 * Two things dominate this cohort and both are easy to model away by accident:
 *
 *  - Most of them have very little saved. SCF 2022 puts the median retirement
 *    balance under 35 at about $19k *among those who have an account at all*,
 *    and a large minority have no account whatsoever. A calculator that opens
 *    by asking for a portfolio balance is already failing them.
 *
 *  - Almost none of them know their retirement spending target. They're decades
 *    out. Asking is nearly useless; it has to be derived from income.
 */
export const accumulating: Persona[] = [
  {
    id: 'renter-no-savings-28',
    narrative:
      'Retail supervisor, 28, renting with a roommate. No employer retirement plan, nothing saved, about $3k in checking. Has never used a retirement calculator and half expects it to tell her she is doomed.',
    weight: 0.045,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 28, salary: 38_000, retireAge: 67 })],
      accounts: [],
      spending: 31_000,
    }),
    knows: ['primary.currentAge', 'primary.salary'],
  },
  {
    id: 'first-job-saver-27',
    narrative:
      'Software engineer two years out of school. On the high-deductible health plan for the lower premium, so payroll also skims off a bit for an HSA. Contributes 6% to the 401(k) to get the full match and has not thought about any of it since.',
    weight: 0.018,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 27, salary: 92_000, retireAge: 65, salaryGrowth: 0.015 })],
      accounts: [
        account('pretax', 21_000, { contribution: 5_520, employerMatch: 2_760 }),
        account('roth', 6_500, { contribution: 3_000 }),
        account('hsa', 3_200, { contribution: 1_500 }),
      ],
      spending: 62_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'accounts.pretax.balance',
      'accounts.pretax.contribution',
    ],
  },
  {
    id: 'gig-worker-31',
    narrative:
      'Freelance designer and part-time rideshare. Income swings between $35k and $55k. Opened a Roth IRA once, funds it when a big invoice clears.',
    weight: 0.03,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 31, salary: 45_000, retireAge: 67 })],
      accounts: [account('roth', 8_400, { contribution: 2_000 })],
      spending: 39_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'accounts.roth.balance'],
    knownGaps: ['Irregular year-to-year income; model assumes a smooth salary'],
  },
  {
    id: 'teacher-couple-34',
    narrative:
      'Two public school teachers, both in the state pension system. One is in a non-covered district and will get no Social Security. Small 403(b) balances on the side.',
    weight: 0.015,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [
        primary({ age: 34, salary: 61_000, retireAge: 60, ss: ssNone }),
        spouse({ age: 35, salary: 58_000, retireAge: 60, ss: ssAuto(67) }),
      ],
      accounts: [account('pretax', 27_000, { contribution: 4_800 })],
      pensions: [
        {
          label: 'State teachers pension',
          owner: 'primary',
          annual: 42_000,
          startAge: 60,
          cola: true,
          survivorFraction: 0.5,
        },
        {
          label: 'State teachers pension',
          owner: 'spouse',
          annual: 39_000,
          startAge: 60,
          cola: true,
          survivorFraction: 0.5,
        },
      ],
      spending: 84_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'pensions',
    ],
  },
  {
    id: 'dual-income-tech-35',
    narrative:
      'Married, both working, no kids yet. Maxing both 401(k)s and an HSA. Wants to know whether they could stop at 55.',
    weight: 0.018,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 35, salary: 165_000, retireAge: 55, salaryGrowth: 0.01 }),
        spouse({ age: 36, salary: 120_000, retireAge: 55 }),
      ],
      accounts: [
        account('pretax', 218_000, { contribution: 47_000, employerMatch: 12_000 }),
        account('roth', 64_000, { contribution: 14_000 }),
        account('taxable', 85_000, { contribution: 24_000, costBasis: 71_000 }),
        account('hsa', 19_000, { contribution: 8_550 }),
      ],
      spending: 135_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'accounts.pretax.contribution',
      'accounts.roth.balance',
      'accounts.taxable.balance',
      'accounts.hsa.balance',
      'spending.annual',
    ],
  },
  {
    id: 'single-parent-38',
    narrative:
      'Nurse, two kids, divorced. Contributes 3% to the hospital 401(k). Childcare eats most of what is left, but that ends in about eight years.',
    weight: 0.035,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 38, salary: 78_000, retireAge: 67 })],
      accounts: [account('pretax', 34_000, { contribution: 2_340, employerMatch: 2_340 })],
      expenses: [
        { label: 'Childcare', annual: 14_000, startAge: 38, endAge: 46, inflationAdjusted: true },
      ],
      spending: 58_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'accounts.pretax.balance', 'expenses'],
  },
  {
    id: 'resident-to-attending-32',
    narrative:
      'Medical resident with $280k in student loans and almost nothing saved. Income roughly quadruples in two years. On paper the worst-off person here; in practice nearly certain to be fine.',
    weight: 0.02,
    tier: 2,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 32, salary: 68_000, retireAge: 62, salaryGrowth: 0.09 })],
      accounts: [account('pretax', 9_000, { contribution: 3_400 })],
      expenses: [
        { label: 'Student loans', annual: 34_000, startAge: 34, endAge: 44, inflationAdjusted: false },
      ],
      spending: 95_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'expenses'],
    knownGaps: [
      'A step change in income (residency to attending) is modeled only as a high constant growth rate',
    ],
  },
  {
    id: 'military-e6-30',
    narrative:
      'Active duty, ten years in, contributing to TSP with the 5% match. Vests a pension at twenty years and plans a second civilian career after.',
    weight: 0.015,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 30, salary: 64_000, retireAge: 60 })],
      accounts: [account('pretax', 41_000, { contribution: 3_840, employerMatch: 3_200 })],
      pensions: [
        {
          label: 'Military retirement',
          owner: 'primary',
          annual: 28_000,
          startAge: 40,
          cola: true,
          survivorFraction: 0.55,
        },
      ],
      spending: 66_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'accounts.pretax.balance', 'pensions'],
  },
  {
    id: 'median-family-41',
    narrative:
      'Married with two kids, combined income near the US median. One 401(k) between them, a mortgage with nineteen years left, a few thousand dollars in a Fidelity brokerage account they check on their phone, and no real plan.',
    weight: 0.075,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [
        primary({ age: 41, salary: 56_000, retireAge: 67 }),
        spouse({ age: 40, salary: 32_000, retireAge: 67 }),
      ],
      accounts: [
        account('pretax', 45_000, { contribution: 2_800, employerMatch: 1_680 }),
        account('taxable', 8_000, { contribution: 1_200, costBasis: 6_500 }),
      ],
      expenses: [
        { label: 'Mortgage', annual: 21_600, startAge: 41, endAge: 60, inflationAdjusted: false },
      ],
      spending: 72_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
    ],
  },
  {
    id: 'small-business-owner-43',
    narrative:
      'Owns a three-truck HVAC company. Pays himself $130k through an S-corp and funds a SEP-IRA in good years. Assumes selling the business is the retirement plan.',
    weight: 0.025,
    tier: 2,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 43, salary: 130_000, retireAge: 65 })],
      accounts: [account('pretax', 96_000, { contribution: 12_000 })],
      lumpSums: [
        { label: 'Business sale', amount: 450_000, atAge: 65, into: 'taxable', taxable: true },
      ],
      spending: 98_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'accounts.pretax.balance', 'lumpSums'],
    knownGaps: [
      'Business sale proceeds are highly uncertain and modeled as a fixed lump sum',
    ],
  },
  {
    id: 'fire-aspirant-33',
    narrative:
      'Saves 55% of a $160k salary in an index fund and a maxed 401(k). Wants out at 45, which means thirty years of withdrawals before Social Security starts.',
    weight: 0.01,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 33, salary: 160_000, retireAge: 45, planToAge: 95 })],
      accounts: [
        account('pretax', 145_000, { contribution: 23_500, employerMatch: 8_000 }),
        account('taxable', 310_000, { contribution: 52_000, costBasis: 240_000 }),
        account('roth', 48_000),
      ],
      spending: 58_000,
      assumptions: { stockAllocation: 0.9 },
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'primary.planToAge',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
      'accounts.roth.balance',
      'spending.annual',
      'assumptions.stockAllocation',
    ],
  },
  {
    id: 'late-starter-44',
    narrative:
      'Started saving seriously at 40 after a divorce reset everything. Knows he is behind and wants to know how far.',
    weight: 0.018,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 44, salary: 68_000, retireAge: 70, ss: ssKnown(2_150, 70) })],
      accounts: [account('pretax', 28_000, { contribution: 6_800, employerMatch: 2_040 })],
      spending: 52_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'accounts.pretax.balance',
      'accounts.pretax.contribution',
    ],
  },
  {
    id: 'gig-no-plan-36',
    narrative:
      'Full-time rideshare and delivery driver, self-employed for six years. Has meant to open a SEP-IRA every tax season and never has. Whatever is left over sits in a checking account.',
    weight: 0.05,
    tier: 1,
    question: 'am-i-on-track',
    truth: scenario({
      people: [primary({ age: 36, salary: 42_000, retireAge: 67 })],
      accounts: [],
      spending: 34_000,
    }),
    knows: ['primary.currentAge', 'primary.salary'],
    knownGaps: ['Self-employment income variability and the option to open a SEP-IRA are not modeled as choices'],
  },
]
