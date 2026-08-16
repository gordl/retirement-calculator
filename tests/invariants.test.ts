import { describe, expect, it } from 'vitest'
import type { Scenario } from '../src/engine/types'
import { ACCOUNT_KINDS, simulate } from '../src/engine/ledger'
import { FixedReturn } from '../src/engine/returns'
import { EffectiveRateTax } from '../src/engine/taxes'
import { run, readiness } from '../src/engine/run'
import { PERSONAS } from './personas/index'

/**
 * Invariants that must hold for every household in the library.
 *
 * Closed-form tests prove the engine is right in a few exactly-solvable cases.
 * These prove it stays sane across all fifty — including the awkward ones: the
 * household with nothing saved, the one already out of money, the couple with a
 * twelve-year age gap, the 75-year projection.
 *
 * A violation here is a real bug, not a tuning question.
 */

const taxFor = (s: Scenario) => new EffectiveRateTax(s.assumptions.effectiveTaxRate)

const runPath = (s: Scenario) => {
  const years = Math.max(...s.people.map((p) => p.planToAge - p.currentAge))
  const path = new FixedReturn().paths(years, s.assumptions)[0]!
  return simulate(s, path, taxFor(s))
}

/** Structured clone with a targeted mutation, for the monotonicity sweeps. */
const modify = (s: Scenario, fn: (draft: Scenario) => void): Scenario => {
  const draft = structuredClone(s)
  fn(draft)
  return draft
}

const finite = (n: number) => Number.isFinite(n)

describe('accounting identity', () => {
  it('reconciles every year of every household to the cent', () => {
    // opening + growth + contributions + lump sums + saved surplus
    //   − withdrawals = closing
    //
    // This is the tightest test in the project. Nearly any bookkeeping mistake
    // — a double-counted lump sum, a withdrawal that doesn't leave the account,
    // growth applied twice — breaks it immediately.
    for (const persona of PERSONAS) {
      const { ledger } = runPath(persona.truth)

      for (const y of ledger) {
        const opening = ACCOUNT_KINDS.reduce((s, k) => s + y.opening[k], 0)
        const closing = ACCOUNT_KINDS.reduce((s, k) => s + y.closing[k], 0)
        const withdrawn = ACCOUNT_KINDS.reduce((s, k) => s + y.withdrawals[k], 0)

        const expected =
          opening + y.growth + y.contributions + y.lumpSums + y.savedSurplus - withdrawn

        expect(closing, `${persona.id} year ${y.year}`).toBeCloseTo(expected, 6)
      }
    }
  })
})

describe('nothing impossible happens', () => {
  it('never produces a negative balance', () => {
    for (const persona of PERSONAS) {
      for (const y of runPath(persona.truth).ledger) {
        for (const kind of ACCOUNT_KINDS) {
          expect(y.closing[kind], `${persona.id} year ${y.year} ${kind}`).toBeGreaterThanOrEqual(
            -1e-6,
          )
        }
      }
    }
  })

  it('never produces NaN or Infinity anywhere', () => {
    for (const persona of PERSONAS) {
      const result = runPath(persona.truth)
      expect(finite(result.endingBalance), persona.id).toBe(true)

      for (const y of result.ledger) {
        for (const value of [
          y.wages,
          y.socialSecurity,
          y.pensionIncome,
          y.otherIncome,
          y.lumpSums,
          y.contributions,
          y.growth,
          y.savedSurplus,
          y.spendingNeed,
          y.taxes,
          y.shortfall,
        ]) {
          expect(finite(value), `${persona.id} year ${y.year}`).toBe(true)
        }
        for (const kind of ACCOUNT_KINDS) {
          expect(finite(y.closing[kind]), `${persona.id} year ${y.year}`).toBe(true)
        }
      }
    }
  })

  it('never charges negative tax', () => {
    for (const persona of PERSONAS) {
      for (const y of runPath(persona.truth).ledger) {
        expect(y.taxes, `${persona.id} year ${y.year}`).toBeGreaterThanOrEqual(-1e-9)
      }
    }
  })

  it('never withdraws more than an account holds', () => {
    for (const persona of PERSONAS) {
      for (const y of runPath(persona.truth).ledger) {
        for (const kind of ACCOUNT_KINDS) {
          // Withdrawals come out after growth and contributions, so the ceiling
          // is opening plus this year's inflows, not the opening balance.
          expect(y.withdrawals[kind], `${persona.id} year ${y.year} ${kind}`).toBeLessThanOrEqual(
            y.opening[kind] + y.growth + y.contributions + y.lumpSums + 1e-6,
          )
        }
      }
    }
  })

  it('runs exactly to the planning horizon', () => {
    for (const persona of PERSONAS) {
      const horizon = Math.max(
        ...persona.truth.people.map((p) => p.planToAge - p.currentAge),
      )
      expect(runPath(persona.truth).ledger, persona.id).toHaveLength(horizon)
    }
  })

  it('stops paying income to people past their planning horizon', () => {
    // In a couple with an age gap, the older person's Social Security and wages
    // must stop when their plan ends, not continue to the survivor's horizon.
    const gapCouple = PERSONAS.find((p) => p.id === 'spousal-age-gap-64')!
    const { ledger } = runPath(gapCouple.truth)
    const [older, younger] = gapCouple.truth.people

    // The older person is still counted through the year they reach planToAge
    // (inclusive), so the drop-off shows up the year after.
    const lastYearIncluded = older!.planToAge - older!.currentAge
    expect(lastYearIncluded + 1).toBeLessThan(ledger.length)

    const before = ledger[lastYearIncluded]!
    const after = ledger[lastYearIncluded + 1]!
    expect(after.socialSecurity).toBeLessThan(before.socialSecurity)
    expect(younger!.planToAge - younger!.currentAge).toBe(ledger.length)
  })
})

describe('monotonicity', () => {
  /**
   * These encode the things a user would be right to assume. If saving more
   * ever made the projection worse, the tool would be actively misleading, and
   * the failure would be nearly impossible to spot by eye in any single run.
   */

  it('more savings never produces a worse outcome', () => {
    for (const persona of PERSONAS) {
      const base = runPath(persona.truth)
      const richer = runPath(
        modify(persona.truth, (d) => {
          const pretax = d.accounts.find((a) => a.kind === 'pretax')
          if (pretax) pretax.balance += 250_000
          else d.accounts.push({ kind: 'pretax', balance: 250_000 })
        }),
      )

      expect(richer.endingBalance, persona.id).toBeGreaterThanOrEqual(base.endingBalance - 1e-6)
      if (base.succeeded) expect(richer.succeeded, persona.id).toBe(true)
    }
  })

  it('higher spending never produces a better outcome', () => {
    for (const persona of PERSONAS) {
      const base = runPath(persona.truth)
      const spendier = runPath(
        modify(persona.truth, (d) => {
          d.spending.annual *= 1.25
        }),
      )

      expect(spendier.endingBalance, persona.id).toBeLessThanOrEqual(base.endingBalance + 1e-6)
      if (!base.succeeded) expect(spendier.succeeded, persona.id).toBe(false)
    }
  })

  it('retiring later never produces a worse outcome', () => {
    // Only meaningful for households that still have someone working.
    const stillWorking = PERSONAS.filter((p) =>
      p.truth.people.some((x) => x.currentAge < x.retireAge),
    )
    expect(stillWorking.length).toBeGreaterThan(20)

    for (const persona of stillWorking) {
      const base = runPath(persona.truth)
      const later = runPath(
        modify(persona.truth, (d) => {
          for (const p of d.people) {
            if (p.currentAge < p.retireAge) p.retireAge = Math.min(p.retireAge + 3, p.planToAge - 1)
          }
        }),
      )

      expect(later.endingBalance, persona.id).toBeGreaterThanOrEqual(base.endingBalance - 1e-6)
      if (base.succeeded) expect(later.succeeded, persona.id).toBe(true)
    }
  })

  it('a better return never produces a worse outcome', () => {
    for (const persona of PERSONAS) {
      const base = runPath(persona.truth)
      const better = runPath(
        modify(persona.truth, (d) => {
          d.assumptions.realReturn += 0.02
        }),
      )

      expect(better.endingBalance, persona.id).toBeGreaterThanOrEqual(base.endingBalance - 1e-6)
    }
  })

  it('a higher tax rate never produces a better outcome', () => {
    for (const persona of PERSONAS) {
      const base = runPath(persona.truth)
      const taxed = runPath(
        modify(persona.truth, (d) => {
          d.assumptions.effectiveTaxRate = Math.min(0.45, d.assumptions.effectiveTaxRate + 0.1)
        }),
      )

      expect(taxed.endingBalance, persona.id).toBeLessThanOrEqual(base.endingBalance + 1e-6)
    }
  })
})

describe('determinism', () => {
  it('produces identical results across repeated runs', () => {
    // A shared URL must show its recipient exactly what the sender saw.
    for (const persona of PERSONAS) {
      const a = runPath(persona.truth)
      const b = runPath(persona.truth)
      expect(a.endingBalance, persona.id).toBe(b.endingBalance)
      expect(a.succeeded, persona.id).toBe(b.succeeded)
      expect(a.depletedAtAge, persona.id).toBe(b.depletedAtAge)
    }
  })

  it('is unaffected by the order accounts are listed in', () => {
    for (const persona of PERSONAS) {
      const base = runPath(persona.truth)
      const shuffled = runPath(
        modify(persona.truth, (d) => {
          d.accounts.reverse()
        }),
      )
      expect(shuffled.endingBalance, persona.id).toBeCloseTo(base.endingBalance, 4)
    }
  })
})

describe('the whole thing runs', () => {
  it('produces a readiness answer for every household', () => {
    for (const persona of PERSONAS) {
      const answer = readiness(run(persona.truth))
      expect(typeof answer.lasts, persona.id).toBe('boolean')
      expect(finite(answer.endingBalance), persona.id).toBe(true)
      if (!answer.lasts) {
        expect(answer.depletedAtAge, persona.id).toBeGreaterThanOrEqual(
          persona.truth.people[0]!.currentAge,
        )
      }
    }
  })

  it('says plainly that an already-broken plan is broken', () => {
    // The 79-year-old with nothing left. A tool that returns a cheerful number
    // here is worse than useless.
    const depleted = PERSONAS.find((p) => p.id === 'already-depleted-79')!
    const answer = readiness(run(depleted.truth))
    expect(answer.lasts).toBe(false)
    expect(answer.depletedAtAge).toBe(79)
  })

  it('says the massively overfunded household is fine', () => {
    const rich = PERSONAS.find((p) => p.id === 'massively-overfunded-58')!
    const answer = readiness(run(rich.truth))
    expect(answer.lasts).toBe(true)
    expect(answer.endingBalance).toBeGreaterThan(0)
  })

  it('is fast enough to run on every keystroke', () => {
    // The premise of the product is that the answer appears as you type.
    const start = performance.now()
    for (const persona of PERSONAS) runPath(persona.truth)
    const elapsed = performance.now() - start

    expect(elapsed / PERSONAS.length).toBeLessThan(2) // ms per household
  })
})
