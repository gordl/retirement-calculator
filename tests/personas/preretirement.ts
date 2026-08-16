import type { Persona } from './types'
import { account, primary, scenario, spouse, ssAuto, ssKnown, ssNone } from './build'

/**
 * Ages 55–64. Roughly 17% of US households, and the single most important
 * cohort for this tool — these are the people actually typing "can I retire"
 * into a search box.
 *
 * They are also the cohort where the answer is most sensitive to inputs. A
 * 30-year-old's projection is dominated by decades of compounding; a
 * 60-year-old's is dominated by the spending number, the claim age, and
 * sequence-of-returns risk in the first decade. Getting those three right for
 * this group matters more than everything else in the model combined.
 */
export const preretirement: Persona[] = [
  {
    id: 'median-preretiree-58',
    narrative:
      'Married, kids grown, house nearly paid off. Their balance is right at the national median for the age, which is far less than the internet says it should be.',
    weight: 0.045,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 58, salary: 74_000, retireAge: 66 }),
        spouse({ age: 57, salary: 48_000, retireAge: 66 }),
      ],
      accounts: [
        account('pretax', 188_000, { contribution: 9_000, employerMatch: 2_220 }),
        account('roth', 22_000),
        account('taxable', 31_000, { costBasis: 24_000 }),
      ],
      expenses: [
        { label: 'Mortgage', annual: 18_000, startAge: 58, endAge: 63, inflationAdjusted: false },
      ],
      spending: 76_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'expenses',
    ],
  },
  {
    id: 'affluent-couple-61',
    narrative:
      'Both professionals, want to stop at 63 and travel hard for a decade before slowing down. Have saved well and want confirmation, not advice.',
    weight: 0.025,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 61, salary: 178_000, retireAge: 63, ss: ssKnown(3_680, 67) }),
        spouse({ age: 60, salary: 132_000, retireAge: 63, ss: ssKnown(3_100, 67) }),
      ],
      accounts: [
        account('pretax', 1_240_000, { contribution: 62_000, employerMatch: 14_000 }),
        account('roth', 185_000),
        account('taxable', 290_000, { costBasis: 195_000 }),
        account('hsa', 41_000),
      ],
      spending: { annual: 145_000, path: 'retirement-smile' },
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'primary.ss.monthlyAtFRA',
      'spouse.currentAge',
      'spouse.salary',
      'spouse.ss.monthlyAtFRA',
      'accounts.pretax.balance',
      'accounts.roth.balance',
      'accounts.taxable.balance',
      'spending.annual',
    ],
  },
  {
    id: 'ss-dependent-62',
    narrative:
      'Thirty years of restaurant work, $14k in an IRA, and a plan to claim Social Security the day she turns 62 because there is no alternative. Represents a large and usually ignored share of the population.',
    weight: 0.03,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 62, salary: 41_000, retireAge: 62, ss: ssAuto(62) })],
      accounts: [account('pretax', 14_000)],
      spending: 33_000,
    }),
    knows: ['primary.currentAge', 'primary.salary', 'primary.ss.claimAge'],
  },
  {
    id: 'federal-fers-59',
    narrative:
      'Twenty-six years in a federal agency. FERS pension, a healthy TSP, and the Social Security supplement until 62. Retiring at 60 with confidence.',
    weight: 0.015,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 59, salary: 128_000, retireAge: 60, ss: ssKnown(2_890, 62) })],
      accounts: [account('pretax', 512_000, { contribution: 26_000, employerMatch: 6_400 })],
      pensions: [
        {
          label: 'FERS annuity',
          owner: 'primary',
          annual: 36_000,
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
      'pensions',
      'accounts.pretax.balance',
      'primary.ss.claimAge',
    ],
  },
  {
    id: 'spousal-age-gap-64',
    narrative:
      'He is 64 and ready to stop; she is 52 and has eight more years of work and a decade more of the plan to fund. The gap changes the answer more than either of them expects.',
    weight: 0.01,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 64, salary: 96_000, retireAge: 65, planToAge: 90, ss: ssAuto(67) }),
        spouse({ age: 52, salary: 88_000, retireAge: 62, ss: ssAuto(67) }),
      ],
      accounts: [
        account('pretax', 640_000, { contribution: 22_000, employerMatch: 5_280 }),
        account('roth', 74_000),
      ],
      spending: 98_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'spouse.retireAge',
      'accounts.pretax.balance',
    ],
    knownGaps: [
      'Survivor Social Security benefits after the first death are not yet modeled, which matters most with a large age gap',
    ],
  },
  {
    id: 'widowed-60',
    narrative:
      'Widowed at 58. Inherited her husband’s IRA and is eligible for a survivor benefit. Now doing the math alone for the first time in thirty years.',
    weight: 0.015,
    tier: 2,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 60, salary: 58_000, retireAge: 65, ss: ssKnown(2_460, 66) })],
      accounts: [
        account('pretax', 385_000, { contribution: 7_000 }),
        account('taxable', 68_000, { costBasis: 68_000 }),
      ],
      spending: 62_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
      'spending.annual',
    ],
    knownGaps: [
      'Survivor benefit rules (taking the higher of the two records) are approximated by a manual benefit entry',
      'Inherited IRA 10-year distribution rules are not modeled',
    ],
  },
  {
    id: 'forced-early-retirement-57',
    narrative:
      'Laid off at 56 in a restructuring and has been looking for eighteen months. Not retired by choice and not sure whether to call it. Every month of drawdown before 62 hurts twice.',
    weight: 0.015,
    tier: 1,
    question: 'will-my-money-last',
    truth: scenario({
      people: [primary({ age: 57, salary: 0, retireAge: 56, ss: ssAuto(62) })],
      accounts: [
        account('pretax', 340_000),
        account('taxable', 52_000, { costBasis: 45_000 }),
      ],
      expenses: [
        { label: 'ACA health premiums', annual: 13_200, startAge: 57, endAge: 64, inflationAdjusted: true },
      ],
      spending: 54_000,
    }),
    knows: [
      'primary.currentAge',
      'accounts.pretax.balance',
      'accounts.taxable.balance',
      'spending.annual',
      'expenses',
    ],
  },
  {
    id: 'bridge-to-medicare-60',
    narrative:
      'Wants to retire at 61 but has to buy health insurance on the exchange for four years. The premium is the entire question and he knows it.',
    weight: 0.012,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 60, salary: 142_000, retireAge: 61 }),
        spouse({ age: 59, salary: 0, retireAge: 61, ss: ssAuto(67, 22) }),
      ],
      accounts: [
        account('pretax', 720_000, { contribution: 30_500 }),
        account('roth', 88_000),
        account('taxable', 140_000, { costBasis: 96_000 }),
      ],
      expenses: [
        { label: 'ACA premiums, both', annual: 26_000, startAge: 61, endAge: 64, inflationAdjusted: true },
      ],
      spending: 92_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'accounts.pretax.balance',
      'accounts.roth.balance',
      'accounts.taxable.balance',
      'expenses',
      'spending.annual',
    ],
    knownGaps: [
      'ACA premium subsidies depend on MAGI, which depends on withdrawals — a feedback loop the effective-rate tax model cannot capture',
    ],
  },
  {
    id: 'high-net-worth-63',
    narrative:
      'Sold a company five years ago. $4.2M across accounts and no real spending discipline. The question is not whether he can retire but how much he can spend without noticing a problem too late.',
    weight: 0.008,
    tier: 1,
    question: 'how-much-can-i-spend',
    truth: scenario({
      people: [
        primary({ age: 63, salary: 0, retireAge: 58, ss: ssKnown(3_900, 70) }),
        spouse({ age: 61, salary: 0, retireAge: 58, ss: ssKnown(1_950, 70) }),
      ],
      accounts: [
        account('taxable', 2_600_000, { costBasis: 1_400_000 }),
        account('pretax', 1_350_000),
        account('roth', 250_000),
      ],
      spending: { annual: 180_000, path: 'retirement-smile' },
      assumptions: { stockAllocation: 0.5, effectiveTaxRate: 0.22 },
    }),
    knows: [
      'primary.currentAge',
      'spouse.currentAge',
      'accounts.taxable.balance',
      'accounts.pretax.balance',
      'accounts.roth.balance',
      'primary.ss.monthlyAtFRA',
      'primary.ss.claimAge',
    ],
    knownGaps: [
      'Large embedded capital gains make withdrawal ordering a tax question the effective-rate model cannot answer well',
    ],
  },
  {
    id: 'downsizer-61',
    narrative:
      'Plans to sell the four-bedroom at 64, buy something smaller in a cheaper state, and bank the difference. Counting on roughly $280k net.',
    weight: 0.01,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [
        primary({ age: 61, salary: 82_000, retireAge: 64 }),
        spouse({ age: 63, salary: 39_000, retireAge: 64 }),
      ],
      accounts: [account('pretax', 296_000, { contribution: 11_000 })],
      lumpSums: [
        { label: 'Home downsize proceeds', amount: 280_000, atAge: 64, into: 'taxable', taxable: false },
      ],
      spending: 68_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'spouse.currentAge',
      'spouse.salary',
      'accounts.pretax.balance',
      'lumpSums',
    ],
  },
  {
    id: 'annuity-buyer-59',
    narrative:
      'Rolled $300k into a fixed annuity after 2022 spooked her. Guaranteed income starting at 65, and she sleeps better for it even though the math is arguable.',
    weight: 0.008,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 59, salary: 67_000, retireAge: 65, ss: ssAuto(67) })],
      accounts: [account('pretax', 155_000, { contribution: 8_000 })],
      incomes: [
        {
          label: 'Fixed annuity',
          annual: 21_000,
          startAge: 65,
          inflationAdjusted: false,
          taxable: true,
        },
      ],
      spending: 56_000,
      assumptions: { stockAllocation: 0.4 },
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'accounts.pretax.balance',
      'incomes',
    ],
    knownGaps: ['Annuity is modeled as a nominal income stream; no mortality credits or riders'],
  },
  {
    id: 'no-ss-public-56',
    narrative:
      'Twenty-eight years as a Texas municipal employee in a non-covered system. No Social Security at all, but a strong pension. Most calculators quietly assume a benefit she will never receive.',
    weight: 0.008,
    tier: 1,
    question: 'can-i-retire-at',
    truth: scenario({
      people: [primary({ age: 56, salary: 79_000, retireAge: 62, ss: ssNone })],
      accounts: [account('pretax', 168_000, { contribution: 9_500 })],
      pensions: [
        {
          label: 'Municipal pension',
          owner: 'primary',
          annual: 54_000,
          startAge: 62,
          cola: false,
        },
      ],
      spending: 61_000,
    }),
    knows: [
      'primary.currentAge',
      'primary.salary',
      'primary.retireAge',
      'pensions',
      'accounts.pretax.balance',
    ],
  },
]
