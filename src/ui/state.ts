import type {
  AccountKind,
  Expense,
  IncomeStream,
  LumpSum,
  Pension,
  Scenario,
  SocialSecurity,
  SpendingPath,
} from '../engine/types'
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
  pensionEnabled: boolean
  pensionAnnual: number
  pensionStartAge: number
  pensionCola: boolean
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

/**
 * Shared shape for the "when does this end" question on incomes and
 * expenses. `hasEndAge` gates whether `endAge` is sent to the engine at all
 * — keeping it a plain number rather than `number | null` means NumberField
 * never has to handle a null value, at the cost of carrying a stale number
 * around while the checkbox is off. `toScenario` is what actually decides
 * whether it counts.
 */
interface DurationState {
  startAge: number
  hasEndAge: boolean
  endAge: number
}

export interface IncomeItemState extends DurationState {
  id: string
  label: string
  annual: number
  inflationAdjusted: boolean
  taxable: boolean
}

export interface ExpenseItemState extends DurationState {
  id: string
  label: string
  annual: number
  inflationAdjusted: boolean
}

/**
 * One-time amounts run in both directions, and costs are by far the more
 * common case — a roof, a car, a wedding, an entry fee. The engine encodes
 * that as a negative `amount`, but making the user type a minus sign would
 * be a poor way to ask. The form keeps `amount` positive and carries the
 * direction separately; `toScenario` applies the sign.
 */
export type LumpSumDirection = 'cost' | 'inflow'

export interface LumpSumItemState {
  id: string
  label: string
  direction: LumpSumDirection
  /** Always positive here. Sign is applied from `direction` on conversion. */
  amount: number
  atAge: number
  /** Which account an inflow lands in. Ignored for costs, which are funded
   *  across accounts in withdrawal order like any other spending. */
  into: AccountKind
  taxable: boolean
}

export interface UIState {
  primary: PersonState
  hasSpouse: boolean
  spouse: PersonState
  spendingAnnual: number
  /** True once the user has typed in the spending field themselves — after
   *  that, the auto-estimate stops overwriting it as other fields change. */
  spendingTouched: boolean
  spendingPath: SpendingPath
  /**
   * Household spending before retirement. Opt-in: `preRetirementEnabled`
   * false means "working income covers working life", which is the
   * conservative default described on Spending in engine/types.ts. The
   * amount is kept around while disabled so toggling doesn't lose it.
   */
  preRetirementEnabled: boolean
  preRetirementSpending: number
  accounts: AccountsState
  incomes: IncomeItemState[]
  expenses: ExpenseItemState[]
  lumpSums: LumpSumItemState[]
  realReturn: number
  stockAllocation: number
  effectiveTaxRate: number
  /**
   * Which collapsible sections are expanded. Named for what they contain
   * rather than how advanced they are — grouping by "more detail" vs
   * "advanced" had put irregular expenses and one-time amounts in different
   * sections despite being the same kind of thing, and despite one-time
   * amounts applying to *more* households (32%) than expenses (24%).
   *
   * Local UI state only; never encoded in the URL.
   */
  open: Record<SectionName, boolean>
}

export type SectionName = 'household' | 'income' | 'expenses' | 'assumptions'

const ALL_CLOSED: Record<SectionName, boolean> = {
  household: false,
  income: false,
  expenses: false,
  assumptions: false,
}

let nextItemId = 0
/** IDs exist only for Preact list keys and never leave this module — the
 *  URL encodes the underlying data, not these. A plain counter is enough. */
export function newItemId(): string {
  nextItemId += 1
  return `item-${nextItemId}`
}

export const blankIncome = (startAge: number): IncomeItemState => ({
  id: newItemId(),
  label: '',
  annual: 0,
  startAge,
  hasEndAge: false,
  endAge: startAge + 10,
  inflationAdjusted: true,
  taxable: true,
})

export const blankExpense = (startAge: number): ExpenseItemState => ({
  id: newItemId(),
  label: '',
  annual: 0,
  startAge,
  hasEndAge: false,
  endAge: startAge + 10,
  inflationAdjusted: true,
})

export const blankLumpSum = (atAge: number): LumpSumItemState => ({
  id: newItemId(),
  label: '',
  // Defaults to a cost: across the persona library, one-time costs outnumber
  // windfalls roughly five to one, matching the research that puts major
  // home repair at the top of retirees' financial shocks.
  direction: 'cost',
  amount: 0,
  atAge,
  into: 'taxable',
  taxable: false,
})

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
  pensionEnabled: false,
  pensionAnnual: 0,
  pensionStartAge: DEFAULT_RETIRE_AGE,
  pensionCola: false,
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
      preRetirementEnabled: false,
      preRetirementSpending: 0,
      accounts,
      incomes: [],
      expenses: [],
      lumpSums: [],
      realReturn: DEFAULT_ASSUMPTIONS.realReturn,
      stockAllocation: DEFAULT_ASSUMPTIONS.stockAllocation,
      effectiveTaxRate: DEFAULT_ASSUMPTIONS.effectiveTaxRate,
      open: ALL_CLOSED,
    })),
    spendingTouched: false,
    spendingPath: 'flat',
    preRetirementEnabled: false,
    preRetirementSpending: 0,
    accounts,
    incomes: [],
    expenses: [],
    lumpSums: [],
    realReturn: DEFAULT_ASSUMPTIONS.realReturn,
    stockAllocation: DEFAULT_ASSUMPTIONS.stockAllocation,
    effectiveTaxRate: DEFAULT_ASSUMPTIONS.effectiveTaxRate,
    open: ALL_CLOSED,
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

  const pensions: Pension[] = []
  if (state.primary.pensionEnabled && state.primary.pensionAnnual > 0) {
    pensions.push({
      label: 'Your pension',
      owner: 'primary',
      annual: state.primary.pensionAnnual,
      startAge: state.primary.pensionStartAge,
      cola: state.primary.pensionCola,
    })
  }
  if (state.hasSpouse && state.spouse.pensionEnabled && state.spouse.pensionAnnual > 0) {
    pensions.push({
      label: "Spouse's pension",
      owner: 'spouse',
      annual: state.spouse.pensionAnnual,
      startAge: state.spouse.pensionStartAge,
      cola: state.spouse.pensionCola,
    })
  }

  const incomes: IncomeStream[] = state.incomes
    .filter((i) => i.label.trim() !== '' && i.annual > 0)
    .map((i) => ({
      label: i.label.trim(),
      annual: i.annual,
      startAge: i.startAge,
      inflationAdjusted: i.inflationAdjusted,
      taxable: i.taxable,
      ...(i.hasEndAge ? { endAge: i.endAge } : {}),
    }))

  const expenses: Expense[] = state.expenses
    .filter((e) => e.label.trim() !== '' && e.annual > 0)
    .map((e) => ({
      label: e.label.trim(),
      annual: e.annual,
      startAge: e.startAge,
      inflationAdjusted: e.inflationAdjusted,
      ...(e.hasEndAge ? { endAge: e.endAge } : {}),
    }))

  const lumpSums: LumpSum[] = state.lumpSums
    // `amount` is held positive in the form; Math.abs guards against a typed
    // minus sign turning a cost back into an inflow.
    .filter((l) => l.label.trim() !== '' && l.amount !== 0)
    .map((l) => ({
      label: l.label.trim(),
      amount: l.direction === 'cost' ? -Math.abs(l.amount) : Math.abs(l.amount),
      atAge: l.atAge,
      into: l.into,
      // A cost is never taxable income — the engine ignores the flag for
      // negative amounts, and sending `true` here would only be misleading.
      taxable: l.direction === 'inflow' && l.taxable,
    }))

  return {
    people,
    accounts,
    pensions,
    incomes,
    expenses,
    lumpSums,
    spending: {
      annual: state.spendingAnnual,
      path: state.spendingPath,
      ...(state.preRetirementEnabled && state.preRetirementSpending > 0
        ? { preRetirement: state.preRetirementSpending }
        : {}),
    },
    assumptions: {
      inflation: DEFAULT_ASSUMPTIONS.inflation,
      realReturn: state.realReturn,
      stockAllocation: state.stockAllocation,
      effectiveTaxRate: state.effectiveTaxRate,
      withdrawalOrder: DEFAULT_ASSUMPTIONS.withdrawalOrder,
    },
  }
}

/**
 * `pension` is that person's own pension, if the scenario has one — matched
 * by owner before this is called. The engine allows any number of pensions
 * per person; the form allows one, which is the shape everyone but a couple
 * of edge-case households actually has. A second one is preserved on the URL
 * but won't round-trip into the form.
 */
function fromPerson(p: Scenario['people'][number], pension: Pension | undefined): PersonState {
  const ss = p.socialSecurity
  return {
    age: p.currentAge,
    retireAge: p.retireAge,
    planToAge: p.planToAge,
    salary: p.salary,
    ssMode: ss.mode,
    ssClaimAge: ss.mode === 'none' ? DEFAULT_SS_CLAIM_AGE : ss.claimAge,
    ssMonthly: ss.mode === 'manual' ? ss.monthlyAtFRA : 0,
    pensionEnabled: pension !== undefined,
    pensionAnnual: pension?.annual ?? 0,
    pensionStartAge: pension?.startAge ?? p.retireAge,
    pensionCola: pension?.cola ?? false,
  }
}

export function fromScenario(scenario: Scenario): UIState {
  const primary = scenario.people.find((p) => p.id === 'primary')!
  const spouse = scenario.people.find((p) => p.id === 'spouse')
  const primaryPension = scenario.pensions.find((pn) => pn.owner === 'primary')
  const spousePension = scenario.pensions.find((pn) => pn.owner === 'spouse')

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

  const incomes: IncomeItemState[] = scenario.incomes.map((i) => ({
    id: newItemId(),
    label: i.label,
    annual: i.annual,
    startAge: i.startAge,
    hasEndAge: i.endAge !== undefined,
    endAge: i.endAge ?? i.startAge + 10,
    inflationAdjusted: i.inflationAdjusted,
    taxable: i.taxable,
  }))

  const expenses: ExpenseItemState[] = scenario.expenses.map((e) => ({
    id: newItemId(),
    label: e.label,
    annual: e.annual,
    startAge: e.startAge,
    hasEndAge: e.endAge !== undefined,
    endAge: e.endAge ?? e.startAge + 10,
    inflationAdjusted: e.inflationAdjusted,
  }))

  const lumpSums: LumpSumItemState[] = scenario.lumpSums.map((l) => ({
    id: newItemId(),
    label: l.label,
    direction: l.amount < 0 ? 'cost' : 'inflow',
    amount: Math.abs(l.amount),
    atAge: l.atAge,
    into: l.into,
    taxable: l.taxable,
  }))

  return {
    primary: fromPerson(primary, primaryPension),
    hasSpouse: !!spouse,
    spouse: spouse ? fromPerson(spouse, spousePension) : blankPerson(primary.currentAge),
    spendingAnnual: scenario.spending.annual,
    spendingTouched: true, // a decoded URL always carries an explicit value
    spendingPath: scenario.spending.path,
    preRetirementEnabled: scenario.spending.preRetirement !== undefined,
    preRetirementSpending: scenario.spending.preRetirement ?? 0,
    accounts,
    incomes,
    expenses,
    lumpSums,
    realReturn: scenario.assumptions.realReturn,
    stockAllocation: scenario.assumptions.stockAllocation,
    effectiveTaxRate: scenario.assumptions.effectiveTaxRate,
    // A decoded URL opens whichever sections actually carry data, so a
    // shared link never hides the numbers it was sent to communicate.
    open: {
      household: !!spouse,
      income: scenario.pensions.length > 0 || scenario.incomes.length > 0,
      expenses: scenario.expenses.length > 0 || scenario.lumpSums.length > 0,
      assumptions: false,
    },
  }
}
