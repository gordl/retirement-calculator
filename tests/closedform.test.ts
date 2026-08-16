import { describe, expect, it } from 'vitest'
import { simulate, ACCOUNT_KINDS } from '../src/engine/ledger'
import { EffectiveRateTax, NoTax } from '../src/engine/taxes'
import {
  claimAdjustment,
  estimateAIME,
  piaFromAIME,
} from '../src/engine/socialsecurity'
import { account, primary, scenario, ssNone } from './personas/build'

/**
 * Closed-form tests.
 *
 * These pin the arithmetic to math that can be verified on paper. Every other
 * test in this project checks that the engine behaves sensibly; these check
 * that it is *correct*, in the handful of cases where "correct" has an exact
 * answer. If the ordinary-annuity identities below hold, the compounding,
 * ordering, and gross-up logic are right, and the rest of the engine is
 * bookkeeping on top of a sound core.
 */

const flatReturns = (years: number, r: number) => new Array<number>(years).fill(r)
const total = (b: Record<string, number>) =>
  ACCOUNT_KINDS.reduce((s, k) => s + (b[k] ?? 0), 0)

describe('accumulation matches the future-value-of-an-annuity formula', () => {
  it('compounds a starting balance plus level contributions exactly', () => {
    const r = 0.05
    const start = 100_000
    const contribution = 10_000
    const years = 35 // age 30 to retirement at 65

    const s = scenario({
      people: [
        primary({ age: 30, retireAge: 65, planToAge: 90, salary: 50_000, ss: ssNone }),
      ],
      accounts: [account('pretax', start, { contribution })],
      spending: 40_000,
      assumptions: { realReturn: r, effectiveTaxRate: 0 },
    })

    const result = simulate(s, flatReturns(60, r), new NoTax())

    // B_n = B_0(1+r)^n + C[(1+r)^n - 1]/r  — the ordinary annuity, matching the
    // ledger's grow-then-flow convention.
    const growthFactor = Math.pow(1 + r, years)
    const expected = start * growthFactor + (contribution * (growthFactor - 1)) / r

    const atRetirement = result.ledger[years - 1]!
    expect(total(atRetirement.closing)).toBeCloseTo(expected, 4)
  })

  it('has no contributions and no withdrawals in a pure accumulation year', () => {
    const s = scenario({
      people: [
        primary({ age: 40, retireAge: 65, planToAge: 90, salary: 80_000, ss: ssNone }),
      ],
      accounts: [account('pretax', 50_000, { contribution: 12_000 })],
      spending: 60_000,
      assumptions: { realReturn: 0.05, effectiveTaxRate: 0 },
    })

    const year = simulate(s, flatReturns(50, 0.05), new NoTax()).ledger[0]!

    expect(year.contributions).toBe(12_000)
    expect(total(year.withdrawals)).toBe(0)
    expect(year.spendingNeed).toBe(0)
    expect(year.shortfall).toBe(0)
  })
})

describe('drawdown matches the present-value-of-an-annuity formula', () => {
  /**
   * A portfolio of exactly PV = S·[1 − (1+r)^−n]/r funds n withdrawals of S and
   * lands on precisely zero. This is the single most load-bearing identity in
   * the engine: if it holds, the drawdown ordering and timing are right.
   */
  const r = 0.05
  const spend = 40_000
  const years = 30
  const exactPV = (spend * (1 - Math.pow(1 + r, -years))) / r

  const drawdownScenario = (balance: number) =>
    scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 95, salary: 0, ss: ssNone })],
      accounts: [account('roth', balance)], // Roth so no tax interferes
      spending: spend,
      assumptions: { realReturn: r, effectiveTaxRate: 0 },
    })

  it('funds exactly n years and ends at zero', () => {
    const result = simulate(drawdownScenario(exactPV), flatReturns(years, r), new NoTax())

    expect(result.succeeded).toBe(true)
    expect(result.endingBalance).toBeCloseTo(0, 6)
    expect(result.ledger).toHaveLength(years)
    for (const y of result.ledger) expect(y.shortfall).toBeCloseTo(0, 9)
  })

  it('fails when the portfolio is even slightly short', () => {
    const result = simulate(
      drawdownScenario(exactPV - 1_000),
      flatReturns(years, r),
      new NoTax(),
    )

    expect(result.succeeded).toBe(false)
    expect(result.depletedAtAge).toBe(94) // the final year, age 65 + 29
  })

  it('leaves a surplus when the portfolio is larger', () => {
    const result = simulate(
      drawdownScenario(exactPV + 100_000),
      flatReturns(years, r),
      new NoTax(),
    )

    expect(result.succeeded).toBe(true)
    // The excess compounds untouched for the full period.
    expect(result.endingBalance).toBeCloseTo(100_000 * Math.pow(1 + r, years), 4)
  })

  it('holds at zero return, where the portfolio is just divided up', () => {
    const result = simulate(
      scenario({
        people: [primary({ age: 65, retireAge: 65, planToAge: 85, salary: 0, ss: ssNone })],
        accounts: [account('roth', 20 * 30_000)],
        spending: 30_000,
        assumptions: { realReturn: 0, effectiveTaxRate: 0 },
      }),
      flatReturns(20, 0),
      new NoTax(),
    )

    expect(result.succeeded).toBe(true)
    expect(result.endingBalance).toBeCloseTo(0, 6)
  })
})

describe('tax gross-up', () => {
  it('withdraws enough extra to cover the tax on the withdrawal itself', () => {
    // Netting $40k of spending from a pre-tax account at a 25% rate requires
    // withdrawing 40000 / 0.75 = 53,333.33. Getting this wrong makes every
    // pre-tax-funded plan look better than it is, by roughly the tax rate.
    const rate = 0.25
    const spend = 40_000

    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 90, salary: 0, ss: ssNone })],
      accounts: [account('pretax', 2_000_000)],
      spending: spend,
      assumptions: { realReturn: 0, effectiveTaxRate: rate },
    })

    const year = simulate(s, flatReturns(25, 0), new EffectiveRateTax(rate)).ledger[0]!

    expect(year.withdrawals.pretax).toBeCloseTo(spend / (1 - rate), 6)
    expect(year.taxes).toBeCloseTo((spend / (1 - rate)) * rate, 6)
    // What lands in the household's hands is exactly the spending target.
    expect(year.withdrawals.pretax - year.taxes).toBeCloseTo(spend, 6)
  })

  it('does not gross up Roth withdrawals', () => {
    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 90, salary: 0, ss: ssNone })],
      accounts: [account('roth', 2_000_000)],
      spending: 40_000,
      assumptions: { realReturn: 0, effectiveTaxRate: 0.25 },
    })

    const year = simulate(s, flatReturns(25, 0), new EffectiveRateTax(0.25)).ledger[0]!

    expect(year.withdrawals.roth).toBeCloseTo(40_000, 6)
    expect(year.taxes).toBeCloseTo(0, 6)
  })

  it('taxes only the embedded gain in a taxable account', () => {
    // Half basis, half gain, 20% rate → effective 10% on the withdrawal.
    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 90, salary: 0, ss: ssNone })],
      accounts: [account('taxable', 1_000_000, { costBasis: 500_000 })],
      spending: 40_000,
      assumptions: { realReturn: 0, effectiveTaxRate: 0.2 },
    })

    const year = simulate(s, flatReturns(25, 0), new EffectiveRateTax(0.2)).ledger[0]!

    expect(year.withdrawals.taxable).toBeCloseTo(40_000 / (1 - 0.1), 6)
  })

  it('costs nothing to draw from a taxable account with no gain', () => {
    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 90, salary: 0, ss: ssNone })],
      accounts: [account('taxable', 1_000_000, { costBasis: 1_000_000 })],
      spending: 40_000,
      assumptions: { realReturn: 0, effectiveTaxRate: 0.3 },
    })

    const year = simulate(s, flatReturns(25, 0), new EffectiveRateTax(0.3)).ledger[0]!

    expect(year.withdrawals.taxable).toBeCloseTo(40_000, 6)
    expect(year.taxes).toBeCloseTo(0, 6)
  })
})

describe('Social Security formula', () => {
  it('applies the bend points exactly', () => {
    // At the first bend point the benefit is 90% of AIME.
    expect(piaFromAIME(1_226)).toBeCloseTo(1_226 * 0.9, 6)

    // At the second, 90% of the first slice plus 32% of the next.
    expect(piaFromAIME(7_391)).toBeCloseTo(1_226 * 0.9 + (7_391 - 1_226) * 0.32, 6)

    // Above it, 15% on the excess.
    expect(piaFromAIME(10_000)).toBeCloseTo(
      1_226 * 0.9 + (7_391 - 1_226) * 0.32 + (10_000 - 7_391) * 0.15,
      6,
    )

    expect(piaFromAIME(0)).toBe(0)
  })

  it('is steeply progressive, which is the point', () => {
    // A doubling of earnings produces far less than a doubling of benefit.
    // Any model that treats Social Security as a flat share of income gets
    // both ends of the income distribution wrong.
    const low = piaFromAIME(estimateAIME(30_000, 35))
    const high = piaFromAIME(estimateAIME(120_000, 35))

    const lowReplacement = (low * 12) / 30_000
    const highReplacement = (high * 12) / 120_000

    expect(lowReplacement).toBeGreaterThan(highReplacement * 1.5)
  })

  it('reduces an early claim by the published factors', () => {
    // 62 with an FRA of 67: 36 months at 5/9 of 1%, then 24 at 5/12 of 1%.
    expect(claimAdjustment(62)).toBeCloseTo(1 - 36 * (5 / 9 / 100) - 24 * (5 / 12 / 100), 10)
    expect(claimAdjustment(62)).toBeCloseTo(0.7, 4)
    expect(claimAdjustment(67)).toBe(1)
  })

  it('credits a delayed claim at 8% a year to 70', () => {
    expect(claimAdjustment(70)).toBeCloseTo(1.24, 10)
    expect(claimAdjustment(68)).toBeCloseTo(1.08, 10)
  })

  it('clamps claims outside the legal window', () => {
    expect(claimAdjustment(55)).toBe(claimAdjustment(62))
    expect(claimAdjustment(75)).toBe(claimAdjustment(70))
  })

  it('caps earnings at the wage base', () => {
    // Beyond the wage base, more salary buys no more benefit.
    expect(estimateAIME(500_000, 35)).toBe(estimateAIME(176_100, 35))
  })

  it('prorates a short career, counting missing years as zeros', () => {
    expect(estimateAIME(70_000, 35)).toBeCloseTo(70_000 / 12, 6)
    expect(estimateAIME(70_000, 17.5)).toBeCloseTo(70_000 / 12 / 2, 6)
    expect(estimateAIME(70_000, 0)).toBe(0)
  })
})

describe('non-COLA income erodes in real terms', () => {
  it('halves a fixed pension over roughly thirty years at 2.5% inflation', () => {
    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 95, salary: 0, ss: ssNone })],
      accounts: [account('roth', 1_000_000)],
      pensions: [
        { label: 'Fixed pension', owner: 'primary', annual: 40_000, startAge: 65, cola: false },
      ],
      spending: 60_000,
      assumptions: { realReturn: 0, inflation: 0.025, effectiveTaxRate: 0 },
    })

    const { ledger } = simulate(s, flatReturns(30, 0), new NoTax())

    expect(ledger[0]!.pensionIncome).toBeCloseTo(40_000, 6)
    expect(ledger[28]!.pensionIncome).toBeCloseTo(40_000 / Math.pow(1.025, 28), 6)
    // Just under half its original purchasing power by the end.
    expect(ledger[28]!.pensionIncome).toBeLessThan(20_500)
  })

  it('holds a COLA pension constant in real terms', () => {
    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 95, salary: 0, ss: ssNone })],
      accounts: [account('roth', 1_000_000)],
      pensions: [
        { label: 'COLA pension', owner: 'primary', annual: 40_000, startAge: 65, cola: true },
      ],
      spending: 60_000,
      assumptions: { realReturn: 0, inflation: 0.025, effectiveTaxRate: 0 },
    })

    const { ledger } = simulate(s, flatReturns(30, 0), new NoTax())
    for (const y of ledger) expect(y.pensionIncome).toBeCloseTo(40_000, 6)
  })
})

describe('one-time amounts', () => {
  // A lump sum with a negative amount is a one-time cost. Before these
  // tests, a cost was subtracted straight out of its target account, which
  // drove that balance negative whenever the cost exceeded it — a state the
  // engine's own invariants say is impossible.

  const retiree = (lumpSums: Parameters<typeof scenario>[0]['lumpSums']) =>
    scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 85, salary: 0, ss: ssNone })],
      accounts: [account('roth', 50_000), account('pretax', 500_000)],
      lumpSums,
      spending: 20_000,
      assumptions: { realReturn: 0, effectiveTaxRate: 0 },
    })

  it('funds a one-time cost across accounts in withdrawal order, never going negative', () => {
    // $200k cost against a $50k Roth: the Roth empties, the rest comes from
    // pre-tax, and no account ends the year below zero.
    const { ledger } = simulate(
      retiree([{ label: 'Huge cost', amount: -200_000, atAge: 70, into: 'roth', taxable: false }]),
      flatReturns(20, 0),
      new NoTax(),
    )

    for (const y of ledger) {
      for (const kind of ACCOUNT_KINDS) {
        expect(y.closing[kind], `year ${y.year} ${kind}`).toBeGreaterThanOrEqual(-1e-6)
      }
    }
  })

  it('counts a one-time cost as spending in the year it lands, and only that year', () => {
    const { ledger } = simulate(
      retiree([{ label: 'New roof', amount: -40_000, atAge: 70, into: 'roth', taxable: false }]),
      flatReturns(20, 0),
      new NoTax(),
    )

    expect(ledger[5]!.spendingNeed).toBeCloseTo(20_000 + 40_000, 6)
    expect(ledger[4]!.spendingNeed).toBeCloseTo(20_000, 6)
    expect(ledger[6]!.spendingNeed).toBeCloseTo(20_000, 6)
    // A cost is not an inflow, so it must not show up as one.
    expect(ledger[5]!.lumpSums).toBe(0)
  })

  it('still deposits an incoming lump sum into its chosen account', () => {
    const { ledger } = simulate(
      retiree([{ label: 'Inheritance', amount: 100_000, atAge: 70, into: 'roth', taxable: false }]),
      flatReturns(20, 0),
      new NoTax(),
    )

    expect(ledger[5]!.lumpSums).toBeCloseTo(100_000, 6)
    expect(ledger[5]!.closing.roth).toBeGreaterThan(ledger[4]!.closing.roth)
  })

  it('does not treat a cost as a tax deduction', () => {
    // Taxable ordinary income should never be pushed negative by a cost —
    // taxes owed for the year stay at zero, not below.
    const s = scenario({
      people: [primary({ age: 65, retireAge: 65, planToAge: 85, salary: 0, ss: ssNone })],
      accounts: [account('roth', 900_000)],
      lumpSums: [{ label: 'Big cost', amount: -100_000, atAge: 70, into: 'roth', taxable: true }],
      spending: 20_000,
      assumptions: { realReturn: 0, effectiveTaxRate: 0.25 },
    })

    const { ledger } = simulate(s, flatReturns(20, 0), new EffectiveRateTax(0.25))
    expect(ledger[5]!.taxes).toBeGreaterThanOrEqual(0)
  })

  it('reports a shortfall rather than a negative balance when a cost breaks the plan', () => {
    const result = simulate(
      scenario({
        people: [primary({ age: 65, retireAge: 65, planToAge: 85, salary: 0, ss: ssNone })],
        accounts: [account('roth', 100_000)],
        lumpSums: [{ label: 'Ruinous cost', amount: -500_000, atAge: 70, into: 'roth', taxable: false }],
        spending: 10_000,
        assumptions: { realReturn: 0, effectiveTaxRate: 0 },
      }),
      flatReturns(20, 0),
      new NoTax(),
    )

    expect(result.succeeded).toBe(false)
    expect(result.depletedAtAge).toBe(70)
    for (const y of result.ledger) {
      for (const kind of ACCOUNT_KINDS) expect(y.closing[kind]).toBeGreaterThanOrEqual(-1e-6)
    }
  })
})
