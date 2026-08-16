import type {
  Account,
  AccountKind,
  Assumptions,
  Dollars,
  Expense,
  IncomeStream,
  LumpSum,
  Pension,
  Person,
  Scenario,
  SocialSecurity,
  Spending,
} from '../../src/engine/types'

/**
 * Builders that keep persona definitions readable.
 *
 * These deliberately mirror the app's own defaults so a persona file only has
 * to state what makes that household distinctive. A persona that spells out
 * every field is a persona nobody will maintain.
 */

export const BASE_ASSUMPTIONS: Assumptions = {
  inflation: 0.025,
  realReturn: 0.05,
  stockAllocation: 0.6,
  effectiveTaxRate: 0.15,
  withdrawalOrder: ['taxable', 'pretax', 'roth', 'hsa'],
}

interface PersonSpec {
  age: number
  retireAge?: number
  planToAge?: number
  salary?: Dollars
  salaryGrowth?: number
  ss?: SocialSecurity
}

export function primary(spec: PersonSpec): Person {
  return buildPerson('primary', spec)
}

export function spouse(spec: PersonSpec): Person {
  return buildPerson('spouse', spec)
}

function buildPerson(id: 'primary' | 'spouse', spec: PersonSpec): Person {
  return {
    id,
    currentAge: spec.age,
    retireAge: spec.retireAge ?? 65,
    planToAge: spec.planToAge ?? 92,
    salary: spec.salary ?? 0,
    salaryGrowth: spec.salaryGrowth ?? 0.005,
    socialSecurity: spec.ss ?? { mode: 'auto', claimAge: 67 },
  }
}

/** Social Security estimated from earnings history — the default path. */
export const ssAuto = (claimAge = 67, yearsWorked?: number): SocialSecurity => ({
  mode: 'auto',
  claimAge,
  ...(yearsWorked !== undefined ? { yearsWorked } : {}),
})

/** They looked up their statement and know the number. */
export const ssKnown = (monthlyAtFRA: Dollars, claimAge = 67): SocialSecurity => ({
  mode: 'manual',
  claimAge,
  monthlyAtFRA,
})

/** Non-covered public employment, or short of the 40 credits to qualify. */
export const ssNone: SocialSecurity = { mode: 'none' }

export function account(
  kind: AccountKind,
  balance: Dollars,
  extra: Partial<Omit<Account, 'kind' | 'balance'>> = {},
): Account {
  return { kind, balance, ...extra }
}

interface ScenarioSpec {
  people: Person[]
  accounts?: Account[]
  pensions?: Pension[]
  incomes?: IncomeStream[]
  expenses?: Expense[]
  lumpSums?: LumpSum[]
  spending: Spending | Dollars
  assumptions?: Partial<Assumptions>
}

export function scenario(spec: ScenarioSpec): Scenario {
  return {
    people: spec.people,
    accounts: spec.accounts ?? [],
    pensions: spec.pensions ?? [],
    incomes: spec.incomes ?? [],
    expenses: spec.expenses ?? [],
    lumpSums: spec.lumpSums ?? [],
    spending:
      typeof spec.spending === 'number'
        ? { annual: spec.spending, path: 'flat' }
        : spec.spending,
    assumptions: { ...BASE_ASSUMPTIONS, ...spec.assumptions },
  }
}
