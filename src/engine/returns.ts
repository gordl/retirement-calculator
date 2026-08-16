import type { Assumptions, Rate, ReturnModelName } from './types'
import { mulberry32, nextGaussian } from './rng'
import { HISTORICAL_YEARS, blendedRealReturn, empiricalMoments } from '../data/historical'

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

/**
 * Convert an arithmetic mean/stdev of simple returns to the lognormal
 * parameters (mu, sigma) of the corresponding log-return, so that
 * `E[1+R]` and `Var[1+R]` match the targets exactly.
 *
 * Standard result: if X = 1+R is lognormal with log-mean mu and log-stdev
 * sigma, then E[X] = exp(mu + sigma^2/2) and Var[X] = (exp(sigma^2)-1)*E[X]^2.
 * Solving for (mu, sigma) given a target arithmetic mean and stdev:
 */
function lognormalParams(arithmeticMean: number, arithmeticStdev: number): { mu: number; sigma: number } {
  const m = 1 + arithmeticMean
  const sigma2 = Math.log(1 + (arithmeticStdev / m) ** 2)
  return { mu: Math.log(m) - sigma2 / 2, sigma: Math.sqrt(sigma2) }
}

/**
 * Lognormal Monte Carlo: many independent paths of i.i.d. annual real returns,
 * drawn from a distribution calibrated to match the historical series'
 * empirical mean and standard deviation at the scenario's stock allocation
 * (see `empiricalMoments` in `src/data/historical.ts`).
 *
 * This is what turns "does the money last at 5%?" into "in what share of
 * plausible futures does the money last?" — the honest way to answer a
 * question that a single deterministic number cannot.
 *
 * i.i.d. draws mean this model has no memory: a bad year is exactly as likely
 * to follow a good one as a bad one. That understates the risk of a prolonged
 * downturn early in retirement, which is precisely the risk `HistoricalCohorts`
 * captures by preserving real historical sequences instead of resampling them.
 * The two models are complementary, not redundant, which is why both exist.
 *
 * Seeded and therefore fully deterministic: the same scenario always produces
 * the same 1,000 paths, so a shared URL reproduces identical numbers for
 * whoever opens it.
 */
export class LognormalMC implements ReturnModel {
  readonly name = 'monte-carlo'

  constructor(
    private readonly pathCount = 1000,
    private readonly seed = 20260815,
  ) {}

  paths(years: number, assumptions: Assumptions): ReturnPath[] {
    const { mean, stdev } = empiricalMoments(assumptions.stockAllocation)
    const { mu, sigma } = lognormalParams(mean, stdev)
    const rng = mulberry32(this.seed)

    const result: ReturnPath[] = []
    for (let p = 0; p < this.pathCount; p++) {
      const path: Rate[] = []
      for (let t = 0; t < years; t++) {
        const z = nextGaussian(rng)
        path.push(Math.exp(mu + sigma * z) - 1)
      }
      result.push(path)
    }
    return result
  }
}

/**
 * Historical rolling cohorts: one path per possible start year in
 * 1928–2025, replaying the real sequence of blended real returns from that
 * year forward (wrapping around the series if the horizon runs past 2025).
 *
 * Where Monte Carlo asks "how likely is success across plausible futures",
 * this asks the sharper question: "would this plan have survived every start
 * year the last century actually produced" — including the 1929 crash, the
 * 1937 relapse, the stagflation of the 1966–1982 stretch, and 2008. A plan
 * that clears every cohort here has been tested against real, not synthetic,
 * sequence-of-returns risk.
 */
export class HistoricalCohorts implements ReturnModel {
  readonly name = 'historical'

  paths(years: number, assumptions: Assumptions): ReturnPath[] {
    const series = HISTORICAL_YEARS.map((y) => blendedRealReturn(y, assumptions.stockAllocation))
    const n = series.length

    const result: ReturnPath[] = []
    for (let start = 0; start < n; start++) {
      const path: Rate[] = []
      for (let t = 0; t < years; t++) path.push(series[(start + t) % n]!)
      result.push(path)
    }
    return result
  }
}
