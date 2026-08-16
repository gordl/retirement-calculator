import type { Account, AccountKind, Scenario } from '../../src/engine/types'
import { run } from '../../src/engine/run'
import { estimateSpending } from '../../src/engine/estimates'
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_PLAN_TO_AGE,
  DEFAULT_RETIRE_AGE,
  DEFAULT_SS_CLAIM_AGE,
} from '../../src/url/defaults'
import type { FieldPath, Persona } from '../personas/types'
import { PERSONAS, weightOf } from '../personas/index'

/**
 * The information-value measurement behind "the UI's input order is derived
 * from this ranking rather than designed by intuition."
 *
 * For each field, and for every persona: compare the readiness verdict with
 * that field at its true value against the same scenario with that one field
 * reset to whatever the app would default it to. The population-weighted
 * share of households whose verdict *flips* is that field's information
 * value — the field the tool most needs to ask about is the one where not
 * knowing it most often produces the wrong answer.
 *
 * This deliberately does not collapse to one composite score. `flipRate` (did
 * the yes/no answer change) and `magnitude` (how far did the underlying
 * number move, even when the verdict didn't flip) are reported separately,
 * the same way the persona profile reports raw statistics rather than an
 * invented index — a single number here would hide exactly the judgment
 * calls a human should be making when deciding the input order.
 */

export interface FieldSensitivity {
  field: FieldPath
  /** Population-weighted share of households whose readiness verdict flips. */
  flipRate: number
  /** Population-weighted mean |change in ending balance| ÷ spending, capped at 50. */
  magnitude: number
  /** Share of the population for whom this field is even applicable. */
  applicability: number
}

const clone = (s: Scenario): Scenario => structuredClone(s)

function findAccount(s: Scenario, kind: AccountKind): Account | undefined {
  return s.accounts.find((a) => a.kind === kind)
}

/**
 * One mutator per ranked field: resets that field, on a cloned scenario, to
 * whatever the app would show if the user left it untouched. Returns false if
 * the field doesn't apply to this household at all (e.g. no Roth account),
 * which the caller uses to compute applicability rather than counting it as
 * "no impact".
 */
const DEFAULTERS: Partial<Record<FieldPath, (s: Scenario) => boolean>> = {
  'primary.retireAge': (s) => {
    const p = s.people.find((x) => x.id === 'primary')!
    if (p.retireAge === DEFAULT_RETIRE_AGE) return false
    p.retireAge = DEFAULT_RETIRE_AGE
    return true
  },
  'primary.planToAge': (s) => {
    const p = s.people.find((x) => x.id === 'primary')!
    if (p.planToAge === DEFAULT_PLAN_TO_AGE) return false
    p.planToAge = DEFAULT_PLAN_TO_AGE
    return true
  },
  'primary.salary': (s) => {
    const p = s.people.find((x) => x.id === 'primary')!
    if (p.salary === 0) return false
    p.salary = 0
    return true
  },
  'primary.ss.claimAge': (s) => {
    const p = s.people.find((x) => x.id === 'primary')!
    if (p.socialSecurity.mode === 'none' || p.socialSecurity.claimAge === DEFAULT_SS_CLAIM_AGE) {
      return false
    }
    p.socialSecurity = { ...p.socialSecurity, claimAge: DEFAULT_SS_CLAIM_AGE }
    return true
  },
  'primary.ss.monthlyAtFRA': (s) => {
    const p = s.people.find((x) => x.id === 'primary')!
    if (p.socialSecurity.mode !== 'manual') return false
    p.socialSecurity = { mode: 'auto', claimAge: p.socialSecurity.claimAge }
    return true
  },
  'spouse.retireAge': (s) => {
    const p = s.people.find((x) => x.id === 'spouse')
    if (!p || p.retireAge === DEFAULT_RETIRE_AGE) return false
    p.retireAge = DEFAULT_RETIRE_AGE
    return true
  },
  'spouse.salary': (s) => {
    const p = s.people.find((x) => x.id === 'spouse')
    if (!p || p.salary === 0) return false
    p.salary = 0
    return true
  },
  'spouse.ss.claimAge': (s) => {
    const p = s.people.find((x) => x.id === 'spouse')
    if (!p || p.socialSecurity.mode === 'none' || p.socialSecurity.claimAge === DEFAULT_SS_CLAIM_AGE) {
      return false
    }
    p.socialSecurity = { ...p.socialSecurity, claimAge: DEFAULT_SS_CLAIM_AGE }
    return true
  },
  'spouse.ss.monthlyAtFRA': (s) => {
    const p = s.people.find((x) => x.id === 'spouse')
    if (!p || p.socialSecurity.mode !== 'manual') return false
    p.socialSecurity = { mode: 'auto', claimAge: p.socialSecurity.claimAge }
    return true
  },
  'spending.annual': (s) => {
    const estimated = estimateSpending(s)
    if (s.spending.annual === estimated) return false
    s.spending.annual = estimated
    return true
  },
  'spending.path': (s) => {
    if (s.spending.path === 'flat') return false
    s.spending.path = 'flat'
    return true
  },
  'accounts.pretax.balance': (s) => {
    const a = findAccount(s, 'pretax')
    if (!a || a.balance === 0) return false
    a.balance = 0
    return true
  },
  'accounts.pretax.contribution': (s) => {
    const a = findAccount(s, 'pretax')
    if (!a || !a.contribution) return false
    a.contribution = 0
    return true
  },
  'accounts.roth.balance': (s) => {
    const a = findAccount(s, 'roth')
    if (!a || a.balance === 0) return false
    a.balance = 0
    return true
  },
  'accounts.taxable.balance': (s) => {
    const a = findAccount(s, 'taxable')
    if (!a || a.balance === 0) return false
    a.balance = 0
    return true
  },
  'accounts.hsa.balance': (s) => {
    const a = findAccount(s, 'hsa')
    if (!a || a.balance === 0) return false
    a.balance = 0
    return true
  },
  pensions: (s) => {
    if (s.pensions.length === 0) return false
    s.pensions = []
    return true
  },
  incomes: (s) => {
    if (s.incomes.length === 0) return false
    s.incomes = []
    return true
  },
  expenses: (s) => {
    if (s.expenses.length === 0) return false
    s.expenses = []
    return true
  },
  lumpSums: (s) => {
    if (s.lumpSums.length === 0) return false
    s.lumpSums = []
    return true
  },
  // assumptions.realReturn is deliberately not ranked: personas.test.ts
  // already establishes that nobody states an opinion on their return
  // assumption, and the persona library reflects that honestly — every
  // household leaves it at the default, so there is no population signal to
  // rank. Asking about it at all is a question for the assumptions
  // themselves (is 5% real the right headline number), not for input
  // ordering.
  'assumptions.stockAllocation': (s) => {
    if (s.assumptions.stockAllocation === DEFAULT_ASSUMPTIONS.stockAllocation) return false
    s.assumptions.stockAllocation = DEFAULT_ASSUMPTIONS.stockAllocation
    return true
  },
  'assumptions.effectiveTaxRate': (s) => {
    if (s.assumptions.effectiveTaxRate === DEFAULT_ASSUMPTIONS.effectiveTaxRate) return false
    s.assumptions.effectiveTaxRate = DEFAULT_ASSUMPTIONS.effectiveTaxRate
    return true
  },
}

/** Fields this harness knows how to measure. Structural/always-asked fields
 *  (currentAge) and fields with no meaningful single "default" (withdrawal
 *  order — any permutation is a legitimate choice, not a knowledge gap) are
 *  intentionally excluded from ranking. */
export const RANKED_FIELDS = Object.keys(DEFAULTERS) as FieldPath[]

function succeeded(scenario: Scenario): boolean {
  return run(scenario).fixed.paths[0]!.succeeded
}

function endingBalance(scenario: Scenario): number {
  return run(scenario).fixed.paths[0]!.endingBalance
}

export function measureField(field: FieldPath, personas: Persona[] = PERSONAS): FieldSensitivity {
  const defaulter = DEFAULTERS[field]
  if (!defaulter) throw new Error(`no defaulter registered for field "${field}"`)

  let flipWeight = 0
  let magnitudeWeightedSum = 0
  let applicableWeight = 0
  let totalWeight = 0

  for (const persona of personas) {
    const w = weightOf(persona)
    totalWeight += w

    const truth = persona.truth
    const defaulted = clone(truth)
    const applies = defaulter(defaulted)
    if (!applies) continue
    applicableWeight += w

    const truthSucceeded = succeeded(truth)
    const defaultedSucceeded = succeeded(defaulted)
    if (truthSucceeded !== defaultedSucceeded) flipWeight += w

    const spendingScale = Math.max(truth.spending.annual, 1)
    const relativeChange = Math.abs(endingBalance(truth) - endingBalance(defaulted)) / spendingScale
    magnitudeWeightedSum += w * Math.min(relativeChange, 50)
  }

  return {
    field,
    flipRate: totalWeight > 0 ? flipWeight / totalWeight : 0,
    magnitude: totalWeight > 0 ? magnitudeWeightedSum / totalWeight : 0,
    applicability: totalWeight > 0 ? applicableWeight / totalWeight : 0,
  }
}

export function rankFields(personas: Persona[] = PERSONAS): FieldSensitivity[] {
  return RANKED_FIELDS.map((f) => measureField(f, personas)).sort(
    (a, b) => b.flipRate - a.flipRate || b.magnitude - a.magnitude,
  )
}
