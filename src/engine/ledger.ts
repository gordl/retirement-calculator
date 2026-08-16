import type {
  AccountKind,
  Dollars,
  PathResult,
  Scenario,
  YearLedger,
} from './types'
import type { ReturnPath } from './returns'
import type { TaxModel } from './taxes'
import { annualBenefit } from './socialsecurity'
import { spendingMultiplier } from './spending'

/**
 * The ledger: one household, one sequence of returns, year by year.
 *
 * Everything the tool reports is a reduction over the rows this produces. There
 * is no second simulation path and no special case for Monte Carlo — a
 * stochastic run is this same function called a thousand times with different
 * return sequences.
 *
 * ## Conventions that the rest of the engine depends on
 *
 * **Real dollars throughout.** Nothing here is inflated. A non-COLA pension is
 * deflated instead, because in real terms that is exactly what happens to it —
 * and that erosion is large enough over thirty years to change conclusions.
 *
 * **Growth first, then flows.** Each year the portfolio grows, then
 * contributions go in and withdrawals come out. This is the ordinary-annuity
 * convention, which is what makes the closed-form tests exact rather than
 * approximate.
 *
 * **Accumulation is contribution-driven, not budget-driven.** Before anyone
 * retires, the portfolio changes only by contributions and growth. Pre-
 * retirement spending is not simulated against it. This is a deliberate
 * choice: modeling a working household's full budget would require users to
 * supply a precise budget they do not have, and it would double-count against
 * the contribution figure they can supply. The cost is that expenses which
 * start and end entirely before retirement have no effect on the projection.
 */

export const ACCOUNT_KINDS: AccountKind[] = ['taxable', 'pretax', 'roth', 'hsa']

const zeroByKind = (): Record<AccountKind, Dollars> => ({
  taxable: 0,
  pretax: 0,
  roth: 0,
  hsa: 0,
})

/** Real value of a nominal amount fixed at `yearsAgo`, given real inflation. */
function realValue(nominal: Dollars, inflation: number, yearsElapsed: number): Dollars {
  return nominal / Math.pow(1 + inflation, Math.max(0, yearsElapsed))
}

export function simulate(
  scenario: Scenario,
  returns: ReturnPath,
  tax: TaxModel,
): PathResult {
  const { people, accounts, pensions, incomes, expenses, lumpSums, spending, assumptions } =
    scenario

  const primary = people.find((p) => p.id === 'primary')
  if (!primary) throw new Error('scenario has no primary person')

  const horizon = Math.max(...people.map((p) => p.planToAge - p.currentAge))
  if (horizon <= 0) throw new Error('planToAge must be beyond currentAge')

  /**
   * Drawdown begins when the *first* person stops working — that's when the
   * household starts living a retirement lifestyle. A spouse who keeps working
   * offsets the need with their wages rather than deferring it.
   */
  const retirementStart = Math.min(
    ...people.map((p) => Math.max(0, p.retireAge - p.currentAge)),
  )

  // Mutable portfolio state.
  const balance = zeroByKind()
  let taxableBasis = 0
  for (const a of accounts) {
    balance[a.kind] += a.balance
    if (a.kind === 'taxable') taxableBasis += a.costBasis ?? a.balance
  }

  const ledger: YearLedger[] = []
  let depletedAtAge: number | undefined

  for (let t = 0; t < horizon; t++) {
    const primaryAge = primary.currentAge + t
    const opening = { ...balance }
    const rate = returns[t] ?? returns[returns.length - 1] ?? 0

    // --- Growth, applied before any flows -----------------------------------
    for (const kind of ACCOUNT_KINDS) balance[kind] *= 1 + rate
    const growth = ACCOUNT_KINDS.reduce((s, k) => s + balance[k] - opening[k], 0)

    const inPlan = people.filter((p) => p.currentAge + t <= p.planToAge)
    const working = inPlan.filter((p) => p.currentAge + t < p.retireAge)

    // --- Income -------------------------------------------------------------
    const wages = working.reduce(
      (sum, p) => sum + p.salary * Math.pow(1 + (p.salaryGrowth ?? 0), t),
      0,
    )

    const socialSecurity = inPlan.reduce(
      (sum, p) => sum + annualBenefit(p, p.currentAge + t),
      0,
    )

    let pensionIncome = 0
    for (const pension of pensions) {
      const owner = inPlan.find((p) => p.id === pension.owner)
      if (!owner) continue
      const ownerAge = owner.currentAge + t
      if (ownerAge < pension.startAge) continue
      // A pension without a COLA loses real value every year it's paid. Over a
      // thirty-year retirement that is roughly half its purchasing power.
      pensionIncome += pension.cola
        ? pension.annual
        : realValue(pension.annual, assumptions.inflation, ownerAge - pension.startAge)
    }

    let otherIncome = 0
    let taxableOther = 0
    for (const stream of incomes) {
      if (primaryAge < stream.startAge) continue
      if (stream.endAge !== undefined && primaryAge > stream.endAge) continue
      const amount = stream.inflationAdjusted
        ? stream.annual
        : realValue(stream.annual, assumptions.inflation, primaryAge - stream.startAge)
      otherIncome += amount
      if (stream.taxable) taxableOther += amount
    }

    let lumpSumTotal = 0
    for (const lump of lumpSums) {
      if (lump.atAge !== primaryAge) continue
      lumpSumTotal += lump.amount
      if (lump.taxable) taxableOther += lump.amount
    }

    // --- Contributions ------------------------------------------------------
    // Capped at wages: a household with no earned income cannot fund a 401(k),
    // and without this cap a retiree's stated contribution would be funded by
    // withdrawing from the very portfolio it's meant to be filling.
    let contributions = 0
    if (working.length > 0) {
      const stated = accounts.reduce(
        (sum, a) => sum + (a.contribution ?? 0) + (a.employerMatch ?? 0),
        0,
      )
      contributions = Math.min(stated, wages)
      if (stated > 0) {
        const scale = contributions / stated
        for (const a of accounts) {
          balance[a.kind] += ((a.contribution ?? 0) + (a.employerMatch ?? 0)) * scale
          if (a.kind === 'taxable') taxableBasis += (a.contribution ?? 0) * scale
        }
      }
    }

    // Lump sums land in an account and carry full basis if already taxed.
    for (const lump of lumpSums) {
      if (lump.atAge !== primaryAge) continue
      balance[lump.into] += lump.amount
      if (lump.into === 'taxable') taxableBasis += lump.amount
    }

    // --- Spending need ------------------------------------------------------
    const inDrawdown = t >= retirementStart
    let spendingNeed = 0
    if (inDrawdown) {
      spendingNeed = spending.annual * spendingMultiplier(spending.path, t - retirementStart)
      for (const e of expenses) {
        if (primaryAge < e.startAge) continue
        if (e.endAge !== undefined && primaryAge > e.endAge) continue
        spendingNeed += e.inflationAdjusted
          ? e.annual
          : realValue(e.annual, assumptions.inflation, primaryAge - e.startAge)
      }
    }

    // --- Taxes on income, then withdrawals to close the gap -----------------
    const taxOnIncome = tax.tax({
      wages,
      pretaxWithdrawals: 0,
      taxableGains: 0,
      otherTaxableIncome: taxableOther,
      socialSecurity,
    })

    // Lump sums are deliberately absent here: they land in an account above,
    // not in the year's spendable cash. Counting them in both places would
    // double them. Their tax, however, is owed in the year they're received,
    // which is why they're in `taxableOther`.
    const cashIn = wages + socialSecurity + pensionIncome + otherIncome
    const cashOut = taxOnIncome + spendingNeed + contributions
    let gap = cashOut - cashIn

    const withdrawals = zeroByKind()
    let withdrawalTax = 0
    let savedSurplus = 0

    if (gap > 0) {
      for (const kind of assumptions.withdrawalOrder) {
        if (gap <= 1e-9) break
        const available = balance[kind]
        if (available <= 1e-9) continue

        const gainFraction =
          kind === 'taxable' && available > 0
            ? Math.max(0, (available - taxableBasis) / available)
            : 0
        const marginal = tax.marginalRateOn(kind, gainFraction)

        // Gross up: netting `gap` dollars from an account taxed at `marginal`
        // requires withdrawing gap / (1 - marginal).
        const grossNeeded = marginal >= 1 ? available : gap / (1 - marginal)
        const gross = Math.min(grossNeeded, available)
        const net = gross * (1 - marginal)

        balance[kind] -= gross
        withdrawals[kind] += gross
        withdrawalTax += gross * marginal
        gap -= net

        if (kind === 'taxable') {
          // Basis is consumed proportionally to the fraction of the account sold.
          taxableBasis -= taxableBasis * (gross / available)
        }
      }
    } else if (inDrawdown && gap < 0) {
      // Income exceeded need — common for Social-Security-heavy households in
      // low-spending years. The surplus is saved, not vaporized.
      savedSurplus = -gap
      balance.taxable += savedSurplus
      taxableBasis += savedSurplus
      gap = 0
    } else {
      gap = 0
    }

    const shortfall = Math.max(0, gap)
    if (shortfall > 1e-6 && depletedAtAge === undefined) depletedAtAge = primaryAge

    const spouse = people.find((p) => p.id === 'spouse')

    ledger.push({
      year: t,
      primaryAge,
      ...(spouse ? { spouseAge: spouse.currentAge + t } : {}),
      opening,
      wages,
      socialSecurity,
      pensionIncome,
      otherIncome,
      lumpSums: lumpSumTotal,
      contributions,
      growth,
      savedSurplus,
      spendingNeed,
      taxes: taxOnIncome + withdrawalTax,
      withdrawals,
      closing: { ...balance },
      shortfall,
    })
  }

  const last = ledger[ledger.length - 1]!
  const endingBalance = ACCOUNT_KINDS.reduce((s, k) => s + last.closing[k], 0)

  return {
    ledger,
    succeeded: depletedAtAge === undefined,
    ...(depletedAtAge !== undefined ? { depletedAtAge } : {}),
    endingBalance,
  }
}
