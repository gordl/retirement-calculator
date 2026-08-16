import { describe, expect, it } from 'vitest'
import {
  PERSONAS,
  RAW_WEIGHT_SUM,
  WEIGHTS,
  tier1,
  weightedPercentile,
} from './personas/index'
import type { Persona } from './personas/types'

/**
 * Structural tests for the persona library.
 *
 * The library is hand-authored data, and hand-authored data rots quietly. A
 * typo'd weight or a persona whose `knows` list references streams they don't
 * have would skew every downstream metric without ever throwing. These tests
 * exist so the benchmark can be trusted before anything is measured with it.
 */

const allPeople = (p: Persona) => p.truth.people

describe('library integrity', () => {
  it('has a medium-sized library, not a token one', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(40)
  })

  it('has unique ids', () => {
    const ids = PERSONAS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has authored weights that roughly sum to 1', () => {
    // Not exactly 1 — they're read off published distributions. But a sum far
    // from 1 means someone fat-fingered a weight, which silently distorts every
    // population-weighted metric in the project.
    expect(RAW_WEIGHT_SUM).toBeGreaterThan(0.9)
    expect(RAW_WEIGHT_SUM).toBeLessThan(1.1)
  })

  it('normalizes weights to exactly 1', () => {
    const sum = [...WEIGHTS.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('gives every persona a positive weight and a narrative', () => {
    for (const p of PERSONAS) {
      expect(p.weight, p.id).toBeGreaterThan(0)
      expect(p.narrative.length, p.id).toBeGreaterThan(40)
    }
  })
})

describe('scenario coherence', () => {
  it('always has a primary person, and at most one spouse', () => {
    for (const p of PERSONAS) {
      const people = allPeople(p)
      expect(people.filter((x) => x.id === 'primary').length, p.id).toBe(1)
      expect(people.filter((x) => x.id === 'spouse').length, p.id).toBeLessThanOrEqual(1)
    }
  })

  it('plans to an age beyond the current one', () => {
    for (const p of PERSONAS) {
      for (const person of allPeople(p)) {
        expect(person.planToAge, `${p.id}/${person.id}`).toBeGreaterThan(person.currentAge)
      }
    }
  })

  it('keeps ages and salaries in plausible ranges', () => {
    for (const p of PERSONAS) {
      for (const person of allPeople(p)) {
        expect(person.currentAge, `${p.id}/${person.id}`).toBeGreaterThanOrEqual(18)
        expect(person.currentAge, `${p.id}/${person.id}`).toBeLessThan(100)
        expect(person.salary, `${p.id}/${person.id}`).toBeGreaterThanOrEqual(0)
        expect(person.salary, `${p.id}/${person.id}`).toBeLessThan(2_000_000)
      }
    }
  })

  it('has no negative balances or contributions', () => {
    for (const p of PERSONAS) {
      for (const a of p.truth.accounts) {
        expect(a.balance, `${p.id}/${a.kind}`).toBeGreaterThanOrEqual(0)
        expect(a.contribution ?? 0, `${p.id}/${a.kind}`).toBeGreaterThanOrEqual(0)
        if (a.costBasis !== undefined) {
          expect(a.costBasis, `${p.id}/${a.kind}`).toBeLessThanOrEqual(a.balance)
        }
      }
    }
  })

  it('has at most one account of each kind', () => {
    // The ledger keys balances by kind, so duplicates would be silently dropped.
    for (const p of PERSONAS) {
      const kinds = p.truth.accounts.map((a) => a.kind)
      expect(new Set(kinds).size, p.id).toBe(kinds.length)
    }
  })

  it('gives everyone a positive spending target', () => {
    for (const p of PERSONAS) {
      expect(p.truth.spending.annual, p.id).toBeGreaterThan(0)
    }
  })

  it('only assigns pensions to people who exist in the household', () => {
    for (const p of PERSONAS) {
      const ids = new Set(allPeople(p).map((x) => x.id))
      for (const pension of p.truth.pensions) {
        expect(ids.has(pension.owner), `${p.id}/${pension.label}`).toBe(true)
      }
    }
  })

  it('ends streams after they start', () => {
    for (const p of PERSONAS) {
      for (const s of [...p.truth.incomes, ...p.truth.expenses]) {
        if (s.endAge !== undefined) {
          expect(s.endAge, `${p.id}/${s.label}`).toBeGreaterThanOrEqual(s.startAge)
        }
      }
    }
  })
})

describe('knows lists are honest', () => {
  it('never claims knowledge of a stream the household does not have', () => {
    // Claiming to "know" your pensions when you have none would make the
    // friction metric look better than reality for free.
    for (const p of PERSONAS) {
      if (p.knows.includes('pensions')) expect(p.truth.pensions.length, p.id).toBeGreaterThan(0)
      if (p.knows.includes('incomes')) expect(p.truth.incomes.length, p.id).toBeGreaterThan(0)
      if (p.knows.includes('expenses')) expect(p.truth.expenses.length, p.id).toBeGreaterThan(0)
      if (p.knows.includes('lumpSums')) expect(p.truth.lumpSums.length, p.id).toBeGreaterThan(0)
    }
  })

  it('never claims spouse knowledge in a single-person household', () => {
    for (const p of PERSONAS) {
      const hasSpouse = allPeople(p).some((x) => x.id === 'spouse')
      if (!hasSpouse) {
        const spouseFields = p.knows.filter((f) => f.startsWith('spouse.'))
        expect(spouseFields, p.id).toEqual([])
      }
    }
  })

  it('never claims an account balance for an account they do not hold', () => {
    for (const p of PERSONAS) {
      const kinds = new Set(p.truth.accounts.map((a) => a.kind))
      for (const field of p.knows) {
        const match = /^accounts\.(\w+)\./.exec(field)
        if (match) expect(kinds.has(match[1] as never), `${p.id}/${field}`).toBe(true)
      }
    }
  })

  it('has no duplicate entries', () => {
    for (const p of PERSONAS) {
      expect(new Set(p.knows).size, p.id).toBe(p.knows.length)
    }
  })

  it('gives everyone at least their own age', () => {
    for (const p of PERSONAS) {
      expect(p.knows, p.id).toContain('primary.currentAge')
    }
  })
})

describe('population coverage', () => {
  const weightWhere = (pred: (p: Persona) => boolean) =>
    PERSONAS.filter(pred).reduce((sum, p) => sum + (WEIGHTS.get(p.id) ?? 0), 0)

  const primaryAge = (p: Persona) => p.truth.people[0]!.currentAge
  const totalSavings = (p: Persona) =>
    p.truth.accounts.reduce((sum, a) => sum + a.balance, 0)

  it('spans every age cohort', () => {
    const cohorts: [string, (a: number) => boolean][] = [
      ['25-34', (a) => a >= 25 && a < 35],
      ['35-44', (a) => a >= 35 && a < 45],
      ['45-54', (a) => a >= 45 && a < 55],
      ['55-64', (a) => a >= 55 && a < 65],
      ['65-74', (a) => a >= 65 && a < 75],
      ['75+', (a) => a >= 75],
    ]
    for (const [label, pred] of cohorts) {
      const count = PERSONAS.filter((p) => pred(primaryAge(p))).length
      expect(count, `cohort ${label}`).toBeGreaterThan(0)
    }
  })

  it('is not dominated by the wealthy', () => {
    // The failure mode this library exists to prevent: a benchmark made
    // entirely of people with seven-figure portfolios, which produces a tool
    // tuned for them. The population-weighted median household should look
    // like the SCF median, not like a wealth-management client.
    const medianSavings = weightedPercentile(PERSONAS, totalSavings, 0.5)
    expect(medianSavings).toBeLessThan(300_000)
  })

  it('includes households with essentially nothing saved', () => {
    // Roughly half of US households have no retirement account at all. If this
    // group is missing, the tool will be designed around a portfolio balance
    // field that many users cannot fill in.
    const broke = weightWhere((p) => totalSavings(p) < 25_000)
    expect(broke).toBeGreaterThan(0.1)
  })

  it('includes households where Social Security is most of the income', () => {
    const ssReliant = weightWhere(
      (p) => totalSavings(p) < 150_000 && primaryAge(p) >= 62,
    )
    expect(ssReliant).toBeGreaterThan(0.08)
  })

  it('covers households with no Social Security at all', () => {
    const none = PERSONAS.filter((p) =>
      p.truth.people.some((x) => x.socialSecurity.mode === 'none'),
    )
    expect(none.length).toBeGreaterThan(0)
  })

  it('covers pensions, rental/other income, timed expenses and lump sums', () => {
    expect(PERSONAS.filter((p) => p.truth.pensions.length > 0).length).toBeGreaterThan(3)
    expect(PERSONAS.filter((p) => p.truth.incomes.length > 0).length).toBeGreaterThan(3)
    expect(PERSONAS.filter((p) => p.truth.expenses.length > 0).length).toBeGreaterThan(3)
    expect(PERSONAS.filter((p) => p.truth.lumpSums.length > 0).length).toBeGreaterThan(1)
  })

  it('does not overrepresent account ownership relative to the 2022 SCF', () => {
    // Federal Reserve, "Changes in US Family Finances from 2019 to 2022":
    // 54.3% of families hold any retirement account (401k/IRA, traditional or
    // Roth combined); 21.0% hold stock directly outside retirement accounts.
    // https://www.federalreserve.gov/publications/october-2023-changes-in-us-family-finances-from-2019-to-2022.htm
    //
    // A calculator whose test population is 87% 401k-holders and 45%
    // brokerage-holders (an earlier version of this library was, before this
    // test existed) is being validated against a population far wealthier
    // and more invested than the country it claims to represent. These bounds
    // are deliberately loose — hitting the SCF figures exactly with 50
    // hand-authored households would be false precision — but they catch the
    // library drifting back toward that failure mode.
    const weightWhere = (pred: (p: Persona) => boolean) =>
      PERSONAS.filter(pred).reduce((sum, p) => sum + (WEIGHTS.get(p.id) ?? 0), 0)

    const pretaxOrRoth = weightWhere((p) =>
      p.truth.accounts.some((a) => a.kind === 'pretax' || a.kind === 'roth'),
    )
    expect(pretaxOrRoth).toBeLessThan(0.8) // SCF reference: 0.543

    const taxable = weightWhere((p) => p.truth.accounts.some((a) => a.kind === 'taxable'))
    expect(taxable).toBeLessThan(0.5) // SCF reference: 0.21

    const noTrackedAccounts = weightWhere((p) => p.truth.accounts.length === 0)
    expect(noTrackedAccounts).toBeGreaterThan(0.15) // estimated reference: ~0.35-0.4
  })

  it('covers both single and married households in meaningful numbers', () => {
    // Census puts married-couple households near 48%. This library sits a few
    // points under that, because pushing it higher would distort the age
    // cohorts, which currently track Census within ~2 points. The residual
    // skew is toward single households, which biases the friction metric
    // slightly *pessimistic* (spouse fields under-counted) — the safe
    // direction for a benchmark whose job is to catch things getting slower.
    const married = weightWhere((p) => p.truth.people.length === 2)
    expect(married).toBeGreaterThan(0.35)
    expect(married).toBeLessThan(0.55)
  })

  it('asks all four questions', () => {
    for (const q of [
      'can-i-retire-at',
      'am-i-on-track',
      'how-much-can-i-spend',
      'will-my-money-last',
    ] as const) {
      expect(PERSONAS.filter((p) => p.question === q).length, q).toBeGreaterThan(0)
    }
  })

  it('is mostly tier 1 by weight', () => {
    // Tier 2 personas are allowed to have coverage gaps. If they dominated the
    // population weight, "we cover the US population" would stop being true.
    const t1 = tier1().reduce((sum, p) => sum + (WEIGHTS.get(p.id) ?? 0), 0)
    expect(t1).toBeGreaterThan(0.75)
  })
})

describe('the friction problem this library is meant to expose', () => {
  it('shows that most households cannot state their retirement spending', () => {
    // This is the central design tension. Spending is the highest-information
    // input in the entire model, and most people genuinely do not know it.
    // Any design that simply asks for it will be slow and wrong; the number has
    // to be derivable from income. Asserted here so the fact stays visible.
    const knowsSpending = PERSONAS.filter((p) => p.knows.includes('spending.annual'))
      .reduce((sum, p) => sum + (WEIGHTS.get(p.id) ?? 0), 0)
    expect(knowsSpending).toBeLessThan(0.5)
  })

  it('shows that few households can state their Social Security benefit', () => {
    // Justifies estimating the benefit from salary rather than asking for it.
    const knowsSS = PERSONAS.filter((p) => p.knows.includes('primary.ss.monthlyAtFRA'))
      .reduce((sum, p) => sum + (WEIGHTS.get(p.id) ?? 0), 0)
    expect(knowsSS).toBeLessThan(0.5)
  })

  it('shows that nobody knows their return or tax assumptions', () => {
    // Nobody has ever known their effective tax rate off the top of their head.
    // These must be defaulted, and the defaults must be defensible.
    for (const p of PERSONAS) {
      expect(p.knows, p.id).not.toContain('assumptions.realReturn')
      expect(p.knows, p.id).not.toContain('assumptions.effectiveTaxRate')
      expect(p.knows, p.id).not.toContain('assumptions.inflation')
    }
  })
})
