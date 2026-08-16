import type { AccountKind, Dollars, Rate } from './types'

/**
 * Tax modeling, deliberately simple in v1 and deliberately behind an interface.
 *
 * The effective-rate model below is an approximation and makes no secret of it.
 * The reason to ship it first is that the alternative — full bracket modeling —
 * is a large surface with an annual maintenance cost, and it should not be
 * built until the sensitivity analysis says how much it actually moves answers
 * across the population. That measurement needs a working engine first.
 *
 * `BracketTax` (federal brackets, standard deduction, LTCG rates, Social
 * Security provisional-income taxation, RMDs) implements this same interface
 * and drops in without the ledger changing a line.
 */

export interface TaxableEvents {
  wages: Dollars
  /** Withdrawals from pre-tax accounts. Fully ordinary income. */
  pretaxWithdrawals: Dollars
  /** Realized gains from taxable accounts. Only the gain is taxed, not the basis. */
  taxableGains: Dollars
  /** Taxable income streams and lump sums — rental income, annuities, part-time work. */
  otherTaxableIncome: Dollars
  /** Gross Social Security benefits received. */
  socialSecurity: Dollars
}

export interface TaxModel {
  readonly name: string
  /** Total tax owed for one year. */
  tax(events: TaxableEvents): Dollars
  /**
   * The fraction of a gross withdrawal from this account kind that is lost to
   * tax. The ledger uses this to gross up: to net N dollars of spending from an
   * account taxed at rate t, you must withdraw N / (1 - t).
   *
   * Without this, a plan funded from a pre-tax account silently under-withdraws
   * and the projection comes out optimistic by roughly the tax rate.
   */
  marginalRateOn(kind: AccountKind, gainFraction: number): Rate
}

/**
 * A single blended rate on ordinary income.
 *
 * Known and deliberate simplifications, each of which BracketTax fixes:
 *
 *  - Social Security is treated as untaxed. Correct for the large share of
 *    retirees below the provisional-income thresholds; understates tax for
 *    higher-income households.
 *  - No standard deduction, so tax is overstated at low incomes — which
 *    partially offsets the point above rather than compounding it.
 *  - Capital gains are taxed at the same rate as ordinary income.
 *  - No RMDs, so large pre-tax balances don't generate forced income late.
 */
export class EffectiveRateTax implements TaxModel {
  readonly name = 'effective-rate'

  constructor(private readonly rate: Rate) {
    if (rate < 0 || rate >= 1) throw new Error(`effective tax rate out of range: ${rate}`)
  }

  tax(events: TaxableEvents): Dollars {
    const taxable =
      events.wages + events.pretaxWithdrawals + events.taxableGains + events.otherTaxableIncome
    return Math.max(0, taxable) * this.rate
  }

  marginalRateOn(kind: AccountKind, gainFraction: number): Rate {
    switch (kind) {
      case 'pretax':
        return this.rate
      case 'taxable':
        // Only the embedded gain is taxed. An account with no unrealized gain
        // costs nothing to draw from, which is why it goes first by default.
        return this.rate * Math.min(Math.max(gainFraction, 0), 1)
      case 'roth':
      case 'hsa':
        return 0
    }
  }
}

/** A model with no taxes at all. Used by the closed-form tests. */
export class NoTax implements TaxModel {
  readonly name = 'none'
  tax(): Dollars {
    return 0
  }
  marginalRateOn(): Rate {
    return 0
  }
}
