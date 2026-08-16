import type { AccountKind, Scenario, SocialSecurity, SpendingPath } from '../engine/types'
import { estimateSpending } from '../engine/estimates'
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_PLAN_TO_AGE,
  DEFAULT_RETIRE_AGE,
  DEFAULT_SALARY_GROWTH,
  DEFAULT_SS_CLAIM_AGE,
} from '../url/defaults'

/**
 * The UI's editable state, one level flatter than `Scenario` so form fields
 * can bind to it directly. `toScenario` is the only place that reassembles it
 * into the shape the engine and the URL codec actually operate on.
 */

export type SSMode = 'auto' | 'manual' | 'none'

export interface PersonState {
  age: number
  retireAge: number
  planToAge: number
  salary: number
  ssMode: SSMode
  ssClaimAge: number
  ssMonthly: number
}

export interface AccountState {
  enabled: boolean
  balance: number
  contribution: number
  employerMatch: number
  costBasis: number
  /** True once the user has edited cost basis directly — until then it
   *  tracks the balance automatically, on the conservative "no gain yet"
   *  assumption described in engine/types.ts. */
  costBasisTouched: boolean
}

export type AccountsState = Record<AccountKind, AccountState>

export interface UIState {
  primary: PersonState
  hasSpouse: boolean
  spouse: PersonState
  spendingAnnual: number
  /** True once the user has typed in the spending field themselves — after
   *  that, the auto-estimate stops overwriting it as other fields change. */
  spendingTouched: boolean
  spendingPath: SpendingPath
  accounts: AccountsState
  realReturn: number
  stockAllocation: number
  effectiveTaxRate: number
  showMore: boolean
  showAdvanced: boolean
}

const blankAccount = (): AccountState => ({
  enabled: false,
  balance: 0,
  contribution: 0,
  employerMatch: 0,
  costBasis: 0,
  costBasisTouched: false,
})

const blankPerson = (age: number): PersonState => ({
  age,
  retireAge: DEFAULT_RETIRE_AGE,
  planToAge: DEFAULT_PLAN_TO_AGE,
  salary: 0,
  ssMode: 'auto',
  ssClaimAge: DEFAULT_SS_CLAIM_AGE,
  ssMonthly: 0,
})

/**
 * The example a first-time visitor sees, so the page shows a live result
 * immediately rather than a blank form — an empty state is the single
 * biggest friction cost a calculator can impose. Every number here is
 * editable; nothing about it is load-bearing beyond "plausible enough to
 * anchor on."
 */
export function exampleState(): UIState {
  const accounts: AccountsState = {
    taxable: blankAccount(),
    pretax: {
      enabled: true,
      balance: 120_000,
      contribution: 9_000,
      employerMatch: 2_000,
      costBasis: 0,
      costBasisTouched: false,
    },
    roth: blankAccount(),
    hsa: blankAccount(),
  }

  return {
    primary: { ...blankPerson(45), salary: 90_000 },
    hasSpouse: false,
    spouse: blankPerson(45),
    spendingAnnual: estimateSpending(toScenario({
      primary: { ...blankPerson(45), salary: 90_000 },
      hasSpouse: false,
      spouse: blankPerson(45),
      spendingAnnual: 0,
      spendingTouched: false,
      spendingPath: 'flat',
      accounts,
      realReturn: DEFAULT_ASSUMPTIONS.realReturn,
      stockAllocation: DEFAULT_ASSUMPTIONS.stockAllocation,
      effectiveTaxRate: DEFAULT_ASSUMPTIONS.effectiveTaxRate,
      showMore: false,
      showAdvanced: false,
    })),
    spendingTouched: false,
    spendingPath: 'flat',
    accounts,
    realReturn: DEFAULT_ASSUMPTIONS.realReturn,
    stockAllocation: DEFAULT_ASSUMPTIONS.stockAllocation,
    effectiveTaxRate: DEFAULT_ASSUMPTIONS.effectiveTaxRate,
    showMore: false,
    showAdvanced: false,
  }
}

function toSocialSecurity(p: PersonState): SocialSecurity {
  if (p.ssMode === 'none') return { mode: 'none' }
  if (p.ssMode === 'manual') return { mode: 'manual', claimAge: p.ssClaimAge, monthlyAtFRA: p.ssMonthly }
  return { mode: 'auto', claimAge: p.ssClaimAge }
}

/** Recomputes the spending estimate — called whenever an income-moving field
 *  changes, but only applied by the caller if the user hasn't overridden it. */
export function recomputeSpendingEstimate(state: UIState): number {
  return estimateSpending(toScenario(state))
}

export function toScenario(state: UIState): Scenario {
  const people = [
    {
      id: 'primary' as const,
      currentAge: state.primary.age,
      retireAge: state.primary.retireAge,
      planToAge: state.primary.planToAge,
      salary: state.primary.salary,
      salaryGrowth: DEFAULT_SALARY_GROWTH,
      socialSecurity: toSocialSecurity(state.primary),
    },
    ...(state.hasSpouse
      ? [
          {
            id: 'spouse' as const,
            currentAge: state.spouse.age,
            retireAge: state.spouse.retireAge,
            planToAge: state.spouse.planToAge,
            salary: state.spouse.salary,
            salaryGrowth: DEFAULT_SALARY_GROWTH,
            socialSecurity: toSocialSecurity(state.spouse),
          },
        ]
      : []),
  ]

  const accounts = (Object.keys(state.accounts) as AccountKind[])
    .filter((kind) => state.accounts[kind].enabled)
    .map((kind) => {
      const a = state.accounts[kind]
      return {
        kind,
        balance: a.balance,
        ...(a.contribution ? { contribution: a.contribution } : {}),
        ...(kind === 'pretax' && a.employerMatch ? { employerMatch: a.employerMatch } : {}),
        ...(kind === 'taxable' ? { costBasis: a.costBasis } : {}),
      }
    })

  return {
    people,
    accounts,
    pensions: [],
    incomes: [],
    expenses: [],
    lumpSums: [],
    spending: { annual: state.spendingAnnual, path: state.spendingPath },
    assumptions: {
      inflation: DEFAULT_ASSUMPTIONS.inflation,
      realReturn: state.realReturn,
      stockAllocation: state.stockAllocation,
      effectiveTaxRate: state.effectiveTaxRate,
      withdrawalOrder: DEFAULT_ASSUMPTIONS.withdrawalOrder,
    },
  }
}

function fromPerson(p: Scenario['people'][number]): PersonState {
  const ss = p.socialSecurity
  return {
    age: p.currentAge,
    retireAge: p.retireAge,
    planToAge: p.planToAge,
    salary: p.salary,
    ssMode: ss.mode,
    ssClaimAge: ss.mode === 'none' ? DEFAULT_SS_CLAIM_AGE : ss.claimAge,
    ssMonthly: ss.mode === 'manual' ? ss.monthlyAtFRA : 0,
  }
}

export function fromScenario(scenario: Scenario): UIState {
  const primary = scenario.people.find((p) => p.id === 'primary')!
  const spouse = scenario.people.find((p) => p.id === 'spouse')

  const accounts: AccountsState = {
    taxable: blankAccount(),
    pretax: blankAccount(),
    roth: blankAccount(),
    hsa: blankAccount(),
  }
  for (const a of scenario.accounts) {
    accounts[a.kind] = {
      enabled: true,
      balance: a.balance,
      contribution: a.contribution ?? 0,
      employerMatch: a.kind === 'pretax' ? (a.employerMatch ?? 0) : 0,
      costBasis: a.kind === 'taxable' ? (a.costBasis ?? a.balance) : 0,
      // A cost basis distinct from the balance can only come from a
      // deliberate edit — an untouched field always equals the balance.
      costBasisTouched: a.kind === 'taxable' && a.costBasis !== undefined && a.costBasis !== a.balance,
    }
  }

  return {
    primary: fromPerson(primary),
    hasSpouse: !!spouse,
    spouse: spouse ? fromPerson(spouse) : blankPerson(primary.currentAge),
    spendingAnnual: scenario.spending.annual,
    spendingTouched: true, // a decoded URL always carries an explicit value
    spendingPath: scenario.spending.path,
    accounts,
    realReturn: scenario.assumptions.realReturn,
    stockAllocation: scenario.assumptions.stockAllocation,
    effectiveTaxRate: scenario.assumptions.effectiveTaxRate,
    showMore: !!spouse,
    showAdvanced: false,
  }
}
