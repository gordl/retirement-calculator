import type { Assumptions, Rate, ReturnModelName } from './types'

/**
 * Return models.
 *
 * All three of them — deterministic, Monte Carlo, historical — are just
 * different ways of producing sequences of annual real returns. They feed the
 * same ledger, so "what if I use historical data instead" costs nothing beyond
 * writing the generator. Keeping this interface narrow is what makes that true.
 */

/** One simulated life's worth of annual real returns. */
export type ReturnPath = Rate[]

export interface ReturnModel {
  readonly name: ReturnModelName
  /** One or more equally-likely paths of `years` annual real returns. */
  paths(years: number, assumptions: Assumptions): ReturnPath[]
}

/**
 * A single path at a constant real return.
 *
 * This produces the headline number. It is not a forecast and should never be
 * presented as a probability — a constant return is the one thing markets
 * reliably do not do. Its value is that it is explicable ("at 5% a year, here
 * is what happens") and that it can be checked against closed-form math, which
 * is what pins the rest of the engine down.
 */
export class FixedReturn implements ReturnModel {
  readonly name = 'fixed'

  paths(years: number, assumptions: Assumptions): ReturnPath[] {
    return [new Array<Rate>(Math.max(0, years)).fill(assumptions.realReturn)]
  }
}
