/**
 * The domain model.
 *
 * Two conventions hold everywhere in this file, and breaking either one is the
 * easiest way to introduce a subtle and very hard to spot error:
 *
 * 1. All dollar amounts are in TODAY's dollars (real), not future nominal
 *    dollars. The ledger works entirely in real terms and only converts to
 *    nominal for display. This means a "$90,000 spending target" means the
 *    same standard of living in 2055 as it does now.
 *
 * 2. All rates are real (inflation-adjusted) decimals, not percentages.
 *    0.05 is five percent.
 */

export type Dollars = number
/** A decimal rate. 0.05 = 5%. Real, not nominal, unless the name says otherwise. */
export type Rate = number
export type Age = number

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type PersonId = 'primary' | 'spouse'

/**
 * How this person's Social Security benefit is determined.
 *
 * `auto` is the default and the whole point: rather than sending the user off
 * to ssa.gov mid-session, estimate the benefit from salary and work history.
 * The estimate's error is small next to the other uncertainties in the model,
 * and it removes one of the most common places people abandon a retirement
 * calculator. `manual` is for people who already know their number.
 *
 * `none` is not an edge case worth skipping: some public-sector workers are in
 * non-covered pension systems and genuinely have no Social Security benefit,
 * and others lack the 40 credits to qualify.
 */
export type SocialSecurity =
  | { mode: 'auto'; claimAge: Age; yearsWorked?: number }
  | { mode: 'manual'; claimAge: Age; monthlyAtFRA: Dollars }
  | { mode: 'none' }

export interface Person {
  id: PersonId
  currentAge: Age
  /** Age at which wage income stops. May be in the past for the already-retired. */
  retireAge: Age
  /** Planning horizon. Not a prediction — the age through which money must last. */
  planToAge: Age
  /** Current gross wage income. Zero for the already-retired. */
  salary: Dollars
  /** Real wage growth above inflation. Defaults to a small positive figure. */
  salaryGrowth?: Rate
  socialSecurity: SocialSecurity
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Tax treatment, which is the only thing about an account the ledger cares
 * about. A 401(k), 403(b), 457(b), SEP-IRA and traditional IRA are all
 * `pretax` — distinguishing them would add input burden and change nothing.
 */
export type AccountKind =
  /** Brokerage/savings. Contributions post-tax, growth taxed on realization. */
  | 'taxable'
  /** 401k/403b/457b/traditional IRA. Deductible in, ordinary income out, RMDs apply. */
  | 'pretax'
  /** Roth IRA/Roth 401k. Post-tax in, tax-free out. */
  | 'roth'
  /** HSA. Tax-free in and out for medical; treated as Roth-like after 65. */
  | 'hsa'

export interface Account {
  kind: AccountKind
  balance: Dollars
  /** Annual contribution while working, in today's dollars. */
  contribution?: Dollars
  /** Employer match, `pretax` only. Modeled as an additional contribution. */
  employerMatch?: Dollars
  /**
   * Cost basis for `taxable` accounts. Only the gain is taxed on withdrawal.
   * Unset means we assume basis equals balance (conservative on tax, and
   * roughly right for someone who recently started saving).
   */
  costBasis?: Dollars
  owner?: PersonId
}

// ---------------------------------------------------------------------------
// Income and expense streams
// ---------------------------------------------------------------------------

/**
 * A defined-benefit pension. Kept separate from `IncomeStream` because the
 * COLA and survivor-benefit questions are specific to it, and because public
 * pensions frequently pair with `SocialSecurity: none`.
 */
export interface Pension {
  label: string
  owner: PersonId
  annual: Dollars
  startAge: Age
  /** Most public pensions have a COLA; most private ones do not. */
  cola: boolean
  /** Fraction continuing to the survivor. 0 means the pension dies with them. */
  survivorFraction?: number
}

/** Rental income, annuity payments, part-time work in retirement, royalties. */
export interface IncomeStream {
  label: string
  annual: Dollars
  /** Age of the primary person when this starts. */
  startAge: Age
  /** Inclusive end age. Omitted means it runs through the planning horizon. */
  endAge?: Age
  /** Whether the amount keeps pace with inflation. */
  inflationAdjusted: boolean
  taxable: boolean
}

/**
 * A spending need above the baseline: a mortgage that pays off partway through,
 * college tuition, long-term care, supporting a parent.
 *
 * Time-bounded expenses matter more than they look. A mortgage payoff at 72 is
 * a large permanent step down in required spending, and models that ignore it
 * systematically understate readiness.
 */
export interface Expense {
  label: string
  annual: Dollars
  startAge: Age
  endAge?: Age
  inflationAdjusted: boolean
}

/** A one-off: inheritance, home sale, business sale, a lump-sum pension buyout. */
export interface LumpSum {
  label: string
  amount: Dollars
  atAge: Age
  /** Where it lands. Inheritances and home sales usually land in `taxable`. */
  into: AccountKind
  /** Income tax owed on receipt, if any. */
  taxable: boolean
}

// ---------------------------------------------------------------------------
// Spending
// ---------------------------------------------------------------------------

/**
 * How spending evolves through retirement.
 *
 * `flat` holds real spending constant — the conventional assumption, and
 * conservative. `retirement-smile` reflects what spending data actually shows:
 * an active early phase, a decline through the seventies, and a rise late from
 * health costs. The difference in required savings between the two is large
 * enough to change answers, which is why it's modeled rather than assumed.
 */
export type SpendingPath = 'flat' | 'retirement-smile'

export interface Spending {
  /** Annual retirement spending target in today's dollars, excluding `expenses`. */
  annual: Dollars
  path: SpendingPath
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export interface Assumptions {
  /** Long-run inflation. Only used to convert real results to nominal display. */
  inflation: Rate
  /** Real return used by the deterministic path. */
  realReturn: Rate
  /** Equity share of the portfolio, 0..1. Drives the stochastic models. */
  stockAllocation: number
  /** Blended effective tax rate on ordinary income. Replaced by BracketTax later. */
  effectiveTaxRate: Rate
  /** Order accounts are drawn down in. Conventional default is taxable first. */
  withdrawalOrder: AccountKind[]
}

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------

export interface Scenario {
  people: Person[]
  accounts: Account[]
  pensions: Pension[]
  incomes: IncomeStream[]
  expenses: Expense[]
  lumpSums: LumpSum[]
  spending: Spending
  assumptions: Assumptions
}

// ---------------------------------------------------------------------------
// Simulation output
// ---------------------------------------------------------------------------

/** One simulated year. Everything downstream is a reduction over these. */
export interface YearLedger {
  year: number
  primaryAge: Age
  spouseAge?: Age

  opening: Record<AccountKind, Dollars>

  // Inflows
  wages: Dollars
  socialSecurity: Dollars
  pensionIncome: Dollars
  otherIncome: Dollars
  lumpSums: Dollars

  contributions: Dollars
  growth: Dollars
  /**
   * Income that exceeded the year's need and was saved rather than spent.
   * Common for Social-Security-heavy households in low-spending years. Recorded
   * explicitly so the year's balances reconcile exactly.
   */
  savedSurplus: Dollars

  // Outflows
  spendingNeed: Dollars
  taxes: Dollars
  withdrawals: Record<AccountKind, Dollars>

  closing: Record<AccountKind, Dollars>

  /** Spending that could not be funded. Non-zero means the plan broke this year. */
  shortfall: Dollars
}

/** One complete simulated life, under one sequence of returns. */
export interface PathResult {
  ledger: YearLedger[]
  /** True if every year's spending was fully funded. */
  succeeded: boolean
  /** Primary's age when money first ran out, or undefined if it never did. */
  depletedAtAge?: Age
  /** Real terminal wealth. Negative is impossible; zero means it just barely held. */
  endingBalance: Dollars
}

export type ReturnModelName = 'fixed' | 'monte-carlo' | 'historical'

export interface ModelResult {
  model: ReturnModelName
  paths: PathResult[]
  /** Share of paths fully funded, 0..1. For `fixed` this is 0 or 1. */
  successRate: number
  /** Percentiles of real ending balance across paths. */
  percentiles: { p10: Dollars; p50: Dollars; p90: Dollars }
}

export interface Result {
  fixed: ModelResult
  monteCarlo?: ModelResult
  historical?: ModelResult
}
