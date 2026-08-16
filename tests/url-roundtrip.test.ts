import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { decode, encode } from '../src/url/codec'
import type {
  Account,
  AccountKind,
  Expense,
  IncomeStream,
  LumpSum,
  Pension,
  Person,
  Scenario,
  SocialSecurity,
} from '../src/engine/types'
import { PERSONAS } from './personas/index'

/**
 * The codec canonicalizes account order to a fixed taxable/pretax/roth/hsa
 * sequence (see the "Account order" note in src/url/codec.ts), matching the
 * engine's own invariant that account order has no bearing on a simulation.
 * Comparisons here canonicalize the expected value the same way, rather than
 * asserting an ordering the codec never promised to preserve.
 */
const ACCOUNT_ORDER: AccountKind[] = ['taxable', 'pretax', 'roth', 'hsa']
function canonicalize(scenario: Scenario): Scenario {
  return {
    ...scenario,
    accounts: [...scenario.accounts]
      .sort((a, b) => ACCOUNT_ORDER.indexOf(a.kind) - ACCOUNT_ORDER.indexOf(b.kind))
      .map((a) => ({
        ...a,
        // contribution/employerMatch of exactly 0 and "unset" are the same
        // wire representation (see the comment in encodeAccount) because
        // they're the same value to the ledger. Normalize before comparing,
        // the same way `undefined` and DEFAULT_SALARY_GROWTH are normalized
        // for salaryGrowth by never generating a bare `undefined` above.
        ...(a.contribution === 0 ? { contribution: undefined } : {}),
        ...(a.kind === 'pretax' && a.employerMatch === 0 ? { employerMatch: undefined } : {}),
      })),
  }
}

/**
 * The URL is the save file. These tests exist to guarantee two things that
 * everything else depends on:
 *
 *  1. `decode(encode(s))` reproduces `s` exactly, for anything the app can
 *     produce — not just the tidy cases.
 *  2. A v1 URL decodes the same way forever. The frozen fixture at the bottom
 *     is what would catch a codec change that silently breaks old links.
 */

// ---------------------------------------------------------------------------
// fast-check arbitraries
//
// These generate values already at the codec's canonical precision (integer
// dollars, rates rounded to 4 decimal places) rather than arbitrary floats,
// so that round-trip equality can be exact rather than "close enough". A real
// UI only ever produces values at this precision too — nobody types
// $52,304.7182.
// ---------------------------------------------------------------------------

const dollars = (max = 5_000_000) => fc.integer({ min: 0, max })
const rate = (min = 0, max = 1) =>
  fc.integer({ min: Math.round(min * 10_000), max: Math.round(max * 10_000) }).map((bp) => bp / 10_000)
const age = (min: number, max: number) => fc.integer({ min, max })
const label = () => fc.string({ minLength: 1, maxLength: 24 })

const socialSecurityArb: fc.Arbitrary<SocialSecurity> = fc.oneof(
  fc.record({
    mode: fc.constant('auto' as const),
    claimAge: age(62, 70),
    yearsWorked: fc.option(fc.integer({ min: 0, max: 45 }), { nil: undefined }),
  }),
  fc.record({
    mode: fc.constant('manual' as const),
    claimAge: age(62, 70),
    monthlyAtFRA: dollars(6000),
  }),
  fc.constant({ mode: 'none' as const }),
)

function personArb(id: 'primary' | 'spouse'): fc.Arbitrary<Person> {
  // salaryGrowth is `Rate | undefined` in the type, but every Scenario this
  // codec ever sees is already fully resolved (the persona library and the
  // app both fill in a concrete default before encoding — see
  // src/url/defaults.ts). Generating a literal `undefined` here would test a
  // state the codec's contract was never meant to round-trip: `undefined`
  // and `DEFAULT_SALARY_GROWTH` are intentionally the same wire
  // representation, not two representations of the same value.
  return fc
    .record({
      currentAge: age(22, 85),
      retireAge: age(50, 75),
      planToAge: age(80, 100),
      salary: dollars(400_000),
      salaryGrowth: rate(0, 0.03),
      socialSecurity: socialSecurityArb,
    })
    .map((p) => ({ id, ...p, planToAge: Math.max(p.planToAge, p.currentAge + 1) }))
}

function accountArb(kind: AccountKind): fc.Arbitrary<Account> {
  return fc.record({
    kind: fc.constant(kind),
    balance: dollars(),
    contribution: fc.option(dollars(70_000), { nil: undefined }),
    employerMatch: kind === 'pretax' ? fc.option(dollars(30_000), { nil: undefined }) : fc.constant(undefined),
    costBasis: kind === 'taxable' ? fc.option(dollars(), { nil: undefined }) : fc.constant(undefined),
    owner: fc.option(fc.constantFrom('primary' as const, 'spouse' as const), { nil: undefined }),
  })
}

const pensionArb: fc.Arbitrary<Pension> = fc.record({
  label: label(),
  owner: fc.constantFrom('primary', 'spouse'),
  annual: dollars(150_000),
  startAge: age(50, 75),
  cola: fc.boolean(),
  survivorFraction: fc.option(rate(0, 1), { nil: undefined }),
})

const incomeArb: fc.Arbitrary<IncomeStream> = fc
  .record({
    label: label(),
    annual: dollars(150_000),
    startAge: age(22, 90),
    endAge: fc.option(age(22, 100), { nil: undefined }),
    inflationAdjusted: fc.boolean(),
    taxable: fc.boolean(),
  })
  .map((i) => ({ ...i, endAge: i.endAge !== undefined ? Math.max(i.endAge, i.startAge) : undefined }))

const expenseArb: fc.Arbitrary<Expense> = fc
  .record({
    label: label(),
    annual: dollars(80_000),
    startAge: age(22, 90),
    endAge: fc.option(age(22, 100), { nil: undefined }),
    inflationAdjusted: fc.boolean(),
  })
  .map((e) => ({ ...e, endAge: e.endAge !== undefined ? Math.max(e.endAge, e.startAge) : undefined }))

const lumpSumArb: fc.Arbitrary<LumpSum> = fc.record({
  label: label(),
  amount: dollars(2_000_000),
  atAge: age(22, 95),
  into: fc.constantFrom<AccountKind>('taxable', 'pretax', 'roth', 'hsa'),
  taxable: fc.boolean(),
})

const withdrawalOrderArb: fc.Arbitrary<AccountKind[]> = fc.shuffledSubarray(
  ['taxable', 'pretax', 'roth', 'hsa'] as AccountKind[],
  { minLength: 4, maxLength: 4 },
)

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .record({
    primary: personArb('primary'),
    hasSpouse: fc.boolean(),
    spouse: personArb('spouse'),
    accountKinds: fc.uniqueArray(fc.constantFrom<AccountKind>('taxable', 'pretax', 'roth', 'hsa')),
    spendingAnnual: dollars(300_000),
    spendingPath: fc.constantFrom<'flat' | 'retirement-smile'>('flat', 'retirement-smile'),
    pensions: fc.array(pensionArb, { maxLength: 3 }),
    incomes: fc.array(incomeArb, { maxLength: 3 }),
    expenses: fc.array(expenseArb, { maxLength: 3 }),
    lumpSums: fc.array(lumpSumArb, { maxLength: 3 }),
    inflation: rate(0, 0.08),
    realReturn: rate(-0.02, 0.12),
    stockAllocation: rate(0, 1),
    effectiveTaxRate: rate(0, 0.4),
    withdrawalOrder: withdrawalOrderArb,
  })
  .chain((s) =>
    fc.tuple(...s.accountKinds.map(accountArb)).map((accounts) => ({ ...s, accounts })),
  )
  .map((s): Scenario => {
    // Pension owners must reference a person who actually exists.
    const pensions = s.hasSpouse
      ? s.pensions
      : s.pensions.map((p) => ({ ...p, owner: 'primary' as const }))

    return {
      people: s.hasSpouse ? [s.primary, s.spouse] : [s.primary],
      accounts: s.accounts,
      pensions,
      incomes: s.incomes,
      expenses: s.expenses,
      lumpSums: s.lumpSums,
      spending: { annual: s.spendingAnnual, path: s.spendingPath },
      assumptions: {
        inflation: s.inflation,
        realReturn: s.realReturn,
        stockAllocation: s.stockAllocation,
        effectiveTaxRate: s.effectiveTaxRate,
        withdrawalOrder: s.withdrawalOrder,
      },
    }
  })

describe('property: decode(encode(s)) === s', () => {
  it('round-trips arbitrary scenarios exactly', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const decoded = decode(encode(scenario))
        expect(decoded).toEqual(canonicalize(scenario))
      }),
      { numRuns: 500 },
    )
  })

  it('is idempotent — encoding a decoded scenario reproduces the same query string', () => {
    // Confirms the encoder is canonical: there's exactly one URL for a given
    // scenario, not a family of equivalent ones. Without this, two people
    // with identical plans could get different-looking (if equally valid)
    // links, which would be a strange thing for a "the link is the plan"
    // product to do.
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const once = encode(scenario)
        const twice = encode(decode(once))
        expect(twice).toBe(once)
      }),
      { numRuns: 300 },
    )
  })
})

describe('every persona round-trips', () => {
  for (const persona of PERSONAS) {
    it(`${persona.id}`, () => {
      const url = encode(persona.truth)
      expect(decode(url)).toEqual(canonicalize(persona.truth))
    })
  }

  it('keeps every persona URL under the 2000-character budget', () => {
    // The de facto safe ceiling for links to survive email quoting, chat
    // apps, and older browsers/proxies without truncation.
    for (const persona of PERSONAS) {
      const url = encode(persona.truth)
      expect(url.length, persona.id).toBeLessThan(2000)
    }
  })

  it('keeps the median persona URL comfortably short', () => {
    const lengths = PERSONAS.map((p) => encode(p.truth).length).sort((a, b) => a - b)
    const median = lengths[Math.floor(lengths.length / 2)]!
    expect(median).toBeLessThan(400)
  })
})

describe('defaults are actually omitted', () => {
  it('produces a minimal URL for a bare-minimum scenario', () => {
    const minimal: Scenario = {
      people: [
        {
          id: 'primary',
          currentAge: 40,
          retireAge: 65,
          planToAge: 92,
          salary: 0,
          salaryGrowth: 0.005,
          socialSecurity: { mode: 'auto', claimAge: 67 },
        },
      ],
      accounts: [],
      pensions: [],
      incomes: [],
      expenses: [],
      lumpSums: [],
      spending: { annual: 40_000, path: 'flat' },
      assumptions: {
        inflation: 0.025,
        realReturn: 0.05,
        stockAllocation: 0.6,
        effectiveTaxRate: 0.15,
        withdrawalOrder: ['taxable', 'pretax', 'roth', 'hsa'],
      },
    }

    const url = encode(minimal)
    // Only the two fields with no sensible default should appear: version,
    // current age, and spending. Everything else is implied.
    expect(url).toBe('v=1&pa=40&sp=40k')
  })

  it('omits a default-shaped account entirely if unmentioned, but includes a present one even at zero contribution', () => {
    const withEmptyAccount: Scenario = {
      people: [
        {
          id: 'primary',
          currentAge: 30,
          retireAge: 65,
          planToAge: 92,
          salary: 0,
          salaryGrowth: 0.005,
          socialSecurity: { mode: 'auto', claimAge: 67 },
        },
      ],
      accounts: [{ kind: 'roth', balance: 0 }],
      pensions: [],
      incomes: [],
      expenses: [],
      lumpSums: [],
      spending: { annual: 30_000, path: 'flat' },
      assumptions: {
        inflation: 0.025,
        realReturn: 0.05,
        stockAllocation: 0.6,
        effectiveTaxRate: 0.15,
        withdrawalOrder: ['taxable', 'pretax', 'roth', 'hsa'],
      },
    }

    const url = encode(withEmptyAccount)
    expect(url).toContain('rb=0')
    expect(decode(url).accounts).toEqual([{ kind: 'roth', balance: 0 }])
  })

  it('uses compact k/m suffixes for round dollar amounts', () => {
    expect(encode({
      people: [
        {
          id: 'primary',
          currentAge: 50,
          retireAge: 65,
          planToAge: 92,
          salary: 0,
          salaryGrowth: 0.005,
          socialSecurity: { mode: 'auto', claimAge: 67 },
        },
      ],
      accounts: [{ kind: 'pretax', balance: 380_000 }],
      pensions: [],
      incomes: [],
      expenses: [],
      lumpSums: [],
      spending: { annual: 1_000_000, path: 'flat' },
      assumptions: {
        inflation: 0.025,
        realReturn: 0.05,
        stockAllocation: 0.6,
        effectiveTaxRate: 0.15,
        withdrawalOrder: ['taxable', 'pretax', 'roth', 'hsa'],
      },
    })).toContain('xb=380k')
  })
})

describe('malformed and hostile input', () => {
  it('rejects a scenario URL with no primary person', () => {
    expect(() => decode('v=1&sp=40000')).toThrow()
  })

  it('rejects a scenario URL missing spending', () => {
    expect(() => decode('v=1&pa=40')).toThrow()
  })

  it('rejects an unknown future version rather than guessing', () => {
    expect(() => decode('v=99&pa=40&sp=40000')).toThrow()
  })

  it('percent-decodes labels containing commas and ampersands safely', () => {
    const s: Scenario = {
      people: [
        {
          id: 'primary',
          currentAge: 60,
          retireAge: 65,
          planToAge: 92,
          salary: 0,
          salaryGrowth: 0.005,
          socialSecurity: { mode: 'auto', claimAge: 67 },
        },
      ],
      accounts: [],
      pensions: [
        {
          label: 'State pension, tier 2 & COLA',
          owner: 'primary',
          annual: 20_000,
          startAge: 65,
          cola: true,
        },
      ],
      incomes: [],
      expenses: [],
      lumpSums: [],
      spending: { annual: 40_000, path: 'flat' },
      assumptions: {
        inflation: 0.025,
        realReturn: 0.05,
        stockAllocation: 0.6,
        effectiveTaxRate: 0.15,
        withdrawalOrder: ['taxable', 'pretax', 'roth', 'hsa'],
      },
    }

    expect(decode(encode(s))).toEqual(s)
  })
})

describe('frozen v1 fixture', () => {
  // This exact string must decode to this exact scenario forever. If a future
  // change to the codec breaks this test, it has broken every v1 link anyone
  // has ever shared, and needs a migration path rather than a passing test
  // update.
  const FROZEN_V1_URL =
    'v=1&pa=54&pi=110k&sa=52&si=88k&xb=420k&xc=23k&xm=6k&rb=45k&sp=95k&ai=300&at=1800'

  it('decodes to the expected scenario', () => {
    const scenario = decode(FROZEN_V1_URL)

    expect(scenario.people).toEqual([
      {
        id: 'primary',
        currentAge: 54,
        retireAge: 65,
        planToAge: 92,
        salary: 110_000,
        salaryGrowth: 0.005,
        socialSecurity: { mode: 'auto', claimAge: 67 },
      },
      {
        id: 'spouse',
        currentAge: 52,
        retireAge: 65,
        planToAge: 92,
        salary: 88_000,
        salaryGrowth: 0.005,
        socialSecurity: { mode: 'auto', claimAge: 67 },
      },
    ])
    expect(scenario.accounts).toEqual([
      { kind: 'pretax', balance: 420_000, contribution: 23_000, employerMatch: 6_000 },
      { kind: 'roth', balance: 45_000 },
    ])
    expect(scenario.spending).toEqual({ annual: 95_000, path: 'flat' })
    expect(scenario.assumptions.inflation).toBeCloseTo(0.03, 10)
    expect(scenario.assumptions.effectiveTaxRate).toBeCloseTo(0.18, 10)
  })

  it('re-encodes to the same canonical string', () => {
    expect(encode(decode(FROZEN_V1_URL))).toBe(FROZEN_V1_URL)
  })
})
