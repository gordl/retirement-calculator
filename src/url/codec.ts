import type {
  Account,
  AccountKind,
  Dollars,
  Expense,
  IncomeStream,
  LumpSum,
  Pension,
  Person,
  PersonId,
  Rate,
  Scenario,
  SocialSecurity,
} from '../engine/types'
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_PLAN_TO_AGE,
  DEFAULT_RETIRE_AGE,
  DEFAULT_SALARY_GROWTH,
  DEFAULT_SS_CLAIM_AGE,
} from './defaults'

/**
 * The URL codec — the entire application state as a query string.
 *
 * Design rules, all in service of one goal: a typical plan should fit in a
 * URL short enough to survive a text message, and a v1 link must decode
 * correctly forever.
 *
 *  - **Account order is canonicalized, not preserved.** Every account is
 *    written under a fixed key per kind (`tb`/`xb`/`rb`/`hb`), so `decode`
 *    always returns `accounts` in taxable/pretax/roth/hsa order regardless of
 *    the input order. This matches the engine's own invariant that account
 *    order has no effect on a simulation — `accounts` is conceptually a map
 *    keyed by kind, not a meaningfully ordered list.
 *
 *  - **Short, flat keys.** Every field gets a 1–3 letter query key. There is
 *    no nesting; `pn`/`ic`/`ex`/`ls` use repeated keys for the array fields
 *    (pensions, incomes, expenses, lump sums), which URLSearchParams handles
 *    natively via `getAll`.
 *  - **Defaults are omitted, not encoded.** A field equal to its default in
 *    `./defaults.ts` is left out of the query string entirely. This is what
 *    keeps ordinary plans short — most people don't touch most defaults.
 *  - **Dollars compact to k/m suffixes when exact.** `380000` becomes `380k`;
 *    an amount that isn't a round thousand is written in full digits rather
 *    than lose precision. Precision is never sacrificed for brevity.
 *  - **Rates are integer basis points**, avoiding floating-point string
 *    artifacts like `0.30000000000000004` ever reaching a URL.
 *  - **Versioned.** Every URL starts with `v=1`. `decode` dispatches on it, so
 *    a future schema change can add a migration path instead of breaking
 *    every link ever shared.
 */

const CODEC_VERSION = 1

// ---------------------------------------------------------------------------
// Primitive encoders — every field type funnels through one of these, so
// precision and formatting rules are enforced in exactly one place each.
// ---------------------------------------------------------------------------

/** Round-trips exactly for any integer; uses k/m suffixes only when exact. */
function encDollars(n: Dollars): string {
  const rounded = Math.round(n)
  if (rounded !== 0 && rounded % 1_000_000 === 0) return `${rounded / 1_000_000}m`
  if (rounded !== 0 && rounded % 1_000 === 0) return `${rounded / 1_000}k`
  return String(rounded)
}

function decDollars(s: string): Dollars {
  if (s.endsWith('m')) return Number(s.slice(0, -1)) * 1_000_000
  if (s.endsWith('k')) return Number(s.slice(0, -1)) * 1_000
  return Number(s)
}

/** Integer basis points. 0.055 -> "550". Exact for any rate specified to 4dp. */
function encRate(r: Rate): string {
  return String(Math.round(r * 10_000))
}

function decRate(s: string): Rate {
  return Number(s) / 10_000
}

function encInt(n: number): string {
  return String(Math.round(n))
}

function decInt(s: string): number {
  return Number(s)
}

function encBool(b: boolean): string {
  return b ? '1' : '0'
}

function decBool(s: string): boolean {
  return s === '1'
}

const KIND_LETTER: Record<AccountKind, string> = {
  taxable: 't',
  pretax: 'x',
  roth: 'r',
  hsa: 'h',
}
const LETTER_KIND: Record<string, AccountKind> = {
  t: 'taxable',
  x: 'pretax',
  r: 'roth',
  h: 'hsa',
}

const OWNER_LETTER: Record<PersonId, string> = { primary: 'p', spouse: 's' }
const LETTER_OWNER: Record<string, PersonId> = { p: 'primary', s: 'spouse' }

// ---------------------------------------------------------------------------
// Record encoders for the array fields — one repeated query key per record,
// fields within a record joined by commas. `encodeURIComponent` on the label
// guarantees a raw comma in free text can never be mistaken for a delimiter,
// since its encoded form never contains one.
// ---------------------------------------------------------------------------

function encPension(p: Pension): string {
  return [
    encodeURIComponent(p.label),
    OWNER_LETTER[p.owner],
    encDollars(p.annual),
    encInt(p.startAge),
    encBool(p.cola),
    p.survivorFraction !== undefined ? encRate(p.survivorFraction) : '',
  ].join(',')
}

function decPension(s: string): Pension {
  const [label, owner, annual, startAge, cola, survivor] = s.split(',')
  return {
    label: decodeURIComponent(label!),
    owner: LETTER_OWNER[owner!]!,
    annual: decDollars(annual!),
    startAge: decInt(startAge!),
    cola: decBool(cola!),
    ...(survivor ? { survivorFraction: decRate(survivor) } : {}),
  }
}

function encIncome(i: IncomeStream): string {
  return [
    encodeURIComponent(i.label),
    encDollars(i.annual),
    encInt(i.startAge),
    i.endAge !== undefined ? encInt(i.endAge) : '',
    encBool(i.inflationAdjusted),
    encBool(i.taxable),
  ].join(',')
}

function decIncome(s: string): IncomeStream {
  const [label, annual, startAge, endAge, inflationAdjusted, taxable] = s.split(',')
  return {
    label: decodeURIComponent(label!),
    annual: decDollars(annual!),
    startAge: decInt(startAge!),
    ...(endAge ? { endAge: decInt(endAge) } : {}),
    inflationAdjusted: decBool(inflationAdjusted!),
    taxable: decBool(taxable!),
  }
}

function encExpense(e: Expense): string {
  return [
    encodeURIComponent(e.label),
    encDollars(e.annual),
    encInt(e.startAge),
    e.endAge !== undefined ? encInt(e.endAge) : '',
    encBool(e.inflationAdjusted),
  ].join(',')
}

function decExpense(s: string): Expense {
  const [label, annual, startAge, endAge, inflationAdjusted] = s.split(',')
  return {
    label: decodeURIComponent(label!),
    annual: decDollars(annual!),
    startAge: decInt(startAge!),
    ...(endAge ? { endAge: decInt(endAge) } : {}),
    inflationAdjusted: decBool(inflationAdjusted!),
  }
}

function encLumpSum(l: LumpSum): string {
  return [
    encodeURIComponent(l.label),
    encDollars(l.amount),
    encInt(l.atAge),
    KIND_LETTER[l.into],
    encBool(l.taxable),
  ].join(',')
}

function decLumpSum(s: string): LumpSum {
  const [label, amount, atAge, into, taxable] = s.split(',')
  return {
    label: decodeURIComponent(label!),
    amount: decDollars(amount!),
    atAge: decInt(atAge!),
    into: LETTER_KIND[into!]!,
    taxable: decBool(taxable!),
  }
}

// ---------------------------------------------------------------------------
// Person / Social Security
// ---------------------------------------------------------------------------

const PERSON_PREFIX: Record<PersonId, string> = { primary: 'p', spouse: 's' }

function encodeSocialSecurity(prefix: string, ss: SocialSecurity, params: URLSearchParams): void {
  if (ss.mode === 'none') {
    params.set(`${prefix}sn`, '1')
    return
  }
  if (ss.mode === 'manual') {
    params.set(`${prefix}sm`, encDollars(ss.monthlyAtFRA))
    if (ss.claimAge !== DEFAULT_SS_CLAIM_AGE) params.set(`${prefix}sc`, encInt(ss.claimAge))
    return
  }
  // auto — the implicit default when no ss.* keys are present at all.
  if (ss.claimAge !== DEFAULT_SS_CLAIM_AGE) params.set(`${prefix}sc`, encInt(ss.claimAge))
  if (ss.yearsWorked !== undefined) params.set(`${prefix}sy`, encInt(ss.yearsWorked))
}

function decodeSocialSecurity(prefix: string, params: URLSearchParams): SocialSecurity {
  if (params.get(`${prefix}sn`) === '1') return { mode: 'none' }

  const manual = params.get(`${prefix}sm`)
  const claimAge = params.has(`${prefix}sc`) ? decInt(params.get(`${prefix}sc`)!) : DEFAULT_SS_CLAIM_AGE

  if (manual !== null) {
    return { mode: 'manual', claimAge, monthlyAtFRA: decDollars(manual) }
  }

  const yearsWorked = params.has(`${prefix}sy`) ? decInt(params.get(`${prefix}sy`)!) : undefined
  return { mode: 'auto', claimAge, ...(yearsWorked !== undefined ? { yearsWorked } : {}) }
}

function encodePerson(person: Person, params: URLSearchParams): void {
  const prefix = PERSON_PREFIX[person.id]
  params.set(`${prefix}a`, encInt(person.currentAge))
  if (person.retireAge !== DEFAULT_RETIRE_AGE) params.set(`${prefix}r`, encInt(person.retireAge))
  if (person.planToAge !== DEFAULT_PLAN_TO_AGE) params.set(`${prefix}h`, encInt(person.planToAge))
  if (person.salary !== 0) params.set(`${prefix}i`, encDollars(person.salary))
  if (person.salaryGrowth !== undefined && person.salaryGrowth !== DEFAULT_SALARY_GROWTH) {
    params.set(`${prefix}g`, encRate(person.salaryGrowth))
  }
  encodeSocialSecurity(prefix, person.socialSecurity, params)
}

function decodePerson(id: PersonId, params: URLSearchParams): Person | undefined {
  const prefix = PERSON_PREFIX[id]
  const ageRaw = params.get(`${prefix}a`)
  if (ageRaw === null) return undefined

  return {
    id,
    currentAge: decInt(ageRaw),
    retireAge: params.has(`${prefix}r`) ? decInt(params.get(`${prefix}r`)!) : DEFAULT_RETIRE_AGE,
    planToAge: params.has(`${prefix}h`) ? decInt(params.get(`${prefix}h`)!) : DEFAULT_PLAN_TO_AGE,
    salary: params.has(`${prefix}i`) ? decDollars(params.get(`${prefix}i`)!) : 0,
    salaryGrowth: params.has(`${prefix}g`) ? decRate(params.get(`${prefix}g`)!) : DEFAULT_SALARY_GROWTH,
    socialSecurity: decodeSocialSecurity(prefix, params),
  }
}

// ---------------------------------------------------------------------------
// Accounts — the "at most one account per kind" convention (also enforced on
// the persona library) means each kind gets fixed, non-repeated keys rather
// than needing the repeated-key array treatment.
// ---------------------------------------------------------------------------

const ACCOUNT_PREFIX: Record<AccountKind, string> = KIND_LETTER

function encodeAccount(a: Account, params: URLSearchParams): void {
  const prefix = ACCOUNT_PREFIX[a.kind]
  params.set(`${prefix}b`, encDollars(a.balance))
  // Falsy checks, deliberately: contribution/employerMatch of exactly 0 is
  // indistinguishable from unset to the ledger (both mean "no contribution"),
  // so both collapse to the same omitted wire representation. This is
  // unlike costBasis below, where 0 and "unset" mean genuinely different
  // things (entirely gain vs. assume-basis-equals-balance) and so 0 must be
  // written explicitly.
  if (a.contribution) params.set(`${prefix}c`, encDollars(a.contribution))
  if (a.kind === 'pretax' && a.employerMatch) params.set(`${prefix}m`, encDollars(a.employerMatch))
  if (a.kind === 'taxable' && a.costBasis !== undefined) {
    params.set(`${prefix}k`, encDollars(a.costBasis))
  }
  if (a.owner) params.set(`${prefix}o`, OWNER_LETTER[a.owner])
}

function decodeAccount(kind: AccountKind, params: URLSearchParams): Account | undefined {
  const prefix = ACCOUNT_PREFIX[kind]
  const balanceRaw = params.get(`${prefix}b`)
  if (balanceRaw === null) return undefined

  const account: Account = { kind, balance: decDollars(balanceRaw) }
  if (params.has(`${prefix}c`)) account.contribution = decDollars(params.get(`${prefix}c`)!)
  if (kind === 'pretax' && params.has(`${prefix}m`)) {
    account.employerMatch = decDollars(params.get(`${prefix}m`)!)
  }
  if (kind === 'taxable' && params.has(`${prefix}k`)) {
    account.costBasis = decDollars(params.get(`${prefix}k`)!)
  }
  if (params.has(`${prefix}o`)) account.owner = LETTER_OWNER[params.get(`${prefix}o`)!]
  return account
}

const ACCOUNT_KINDS_ORDER: AccountKind[] = ['taxable', 'pretax', 'roth', 'hsa']

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

function orderEquals(a: AccountKind[], b: AccountKind[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i])
}

export function encode(scenario: Scenario): string {
  const params = new URLSearchParams()
  params.set('v', String(CODEC_VERSION))

  for (const person of scenario.people) encodePerson(person, params)

  // Fixed kind order, not input order — this is what makes encode() produce
  // exactly one canonical string for a given scenario regardless of how its
  // accounts array happens to be ordered (see "Account order" above).
  const byKind = new Map(scenario.accounts.map((a) => [a.kind, a]))
  for (const kind of ACCOUNT_KINDS_ORDER) {
    const account = byKind.get(kind)
    if (account) encodeAccount(account, params)
  }

  params.set('sp', encDollars(scenario.spending.annual))
  if (scenario.spending.path === 'retirement-smile') params.set('sw', '1')
  // Omitted when unset, which is its own meaningful state — see Spending in
  // engine/types.ts. An absent `spp` means working income covers working life.
  if (scenario.spending.preRetirement !== undefined) {
    params.set('spp', encDollars(scenario.spending.preRetirement))
  }

  for (const p of scenario.pensions) params.append('pn', encPension(p))
  for (const i of scenario.incomes) params.append('ic', encIncome(i))
  for (const e of scenario.expenses) params.append('ex', encExpense(e))
  for (const l of scenario.lumpSums) params.append('ls', encLumpSum(l))

  const a = scenario.assumptions
  const d = DEFAULT_ASSUMPTIONS
  if (a.inflation !== d.inflation) params.set('ai', encRate(a.inflation))
  if (a.realReturn !== d.realReturn) params.set('ar', encRate(a.realReturn))
  if (a.stockAllocation !== d.stockAllocation) params.set('aa', encRate(a.stockAllocation))
  if (a.effectiveTaxRate !== d.effectiveTaxRate) params.set('at', encRate(a.effectiveTaxRate))
  if (!orderEquals(a.withdrawalOrder, d.withdrawalOrder)) {
    params.set('ao', a.withdrawalOrder.map((k) => KIND_LETTER[k]).join(''))
  }

  return params.toString()
}

export function decode(query: string): Scenario {
  const params = new URLSearchParams(query)

  const version = params.has('v') ? decInt(params.get('v')!) : CODEC_VERSION
  if (version !== CODEC_VERSION) {
    throw new Error(`unsupported scenario URL version: ${version}`)
  }

  const people: Person[] = []
  const primary = decodePerson('primary', params)
  if (!primary) throw new Error('scenario URL is missing the primary person (pa)')
  people.push(primary)
  const spouse = decodePerson('spouse', params)
  if (spouse) people.push(spouse)

  const accounts: Account[] = []
  for (const kind of ACCOUNT_KINDS_ORDER) {
    const account = decodeAccount(kind, params)
    if (account) accounts.push(account)
  }

  const spendingRaw = params.get('sp')
  if (spendingRaw === null) throw new Error('scenario URL is missing spending (sp)')

  const a = DEFAULT_ASSUMPTIONS
  const orderRaw = params.get('ao')

  return {
    people,
    accounts,
    pensions: params.getAll('pn').map(decPension),
    incomes: params.getAll('ic').map(decIncome),
    expenses: params.getAll('ex').map(decExpense),
    lumpSums: params.getAll('ls').map(decLumpSum),
    spending: {
      annual: decDollars(spendingRaw),
      path: params.get('sw') === '1' ? 'retirement-smile' : 'flat',
      ...(params.has('spp') ? { preRetirement: decDollars(params.get('spp')!) } : {}),
    },
    assumptions: {
      inflation: params.has('ai') ? decRate(params.get('ai')!) : a.inflation,
      realReturn: params.has('ar') ? decRate(params.get('ar')!) : a.realReturn,
      stockAllocation: params.has('aa') ? decRate(params.get('aa')!) : a.stockAllocation,
      effectiveTaxRate: params.has('at') ? decRate(params.get('at')!) : a.effectiveTaxRate,
      withdrawalOrder: orderRaw
        ? orderRaw.split('').map((c) => LETTER_KIND[c]!)
        : a.withdrawalOrder,
    },
  }
}
