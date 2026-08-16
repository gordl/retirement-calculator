import type { Dollars, ModelResult, PathResult, Percentiles, Result, Scenario, YearLedger } from './types'
import type { ReturnModel } from './returns'
import type { TaxModel } from './taxes'
import { FixedReturn } from './returns'
import { EffectiveRateTax } from './taxes'
import { ACCOUNT_KINDS, simulate } from './ledger'

/**
 * Orchestration: run a scenario through one or more return models.
 *
 * The deterministic path always runs — it is fast, explicable, and the number
 * that goes on screen first. The stochastic models are opt-in because they cost
 * a thousand times more and are not always what the caller needs (the
 * sensitivity sweep, for instance, runs tens of thousands of scenarios and only
 * cares about the deterministic answer).
 */

export interface RunOptions {
  tax?: TaxModel
  /** Additional models beyond the deterministic one. */
  models?: ReturnModel[]
}

function percentile(sorted: Dollars[], q: number): Dollars {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))
  return sorted[index]!
}

function fivePercentiles(sorted: Dollars[]): Percentiles {
  return {
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
  }
}

function totalBalance(year: YearLedger): Dollars {
  return ACCOUNT_KINDS.reduce((sum, kind) => sum + year.closing[kind], 0)
}

/**
 * Percentiles of total portfolio balance, one entry per year, across all
 * paths — the fan chart's data. `paths` all share one horizon (they're the
 * same scenario under different return sequences), so every ledger is the
 * same length.
 */
function yearlyPercentilesOf(paths: PathResult[]): Percentiles[] {
  const years = paths[0]?.ledger.length ?? 0
  const result: Percentiles[] = []
  for (let t = 0; t < years; t++) {
    const balances = paths.map((p) => totalBalance(p.ledger[t]!)).sort((a, b) => a - b)
    result.push(fivePercentiles(balances))
  }
  return result
}

function summarize(model: ReturnModel, paths: PathResult[]): ModelResult {
  const endings = paths.map((p) => p.endingBalance).sort((a, b) => a - b)
  return {
    model: model.name,
    paths,
    successRate: paths.filter((p) => p.succeeded).length / paths.length,
    percentiles: {
      p10: percentile(endings, 0.1),
      p50: percentile(endings, 0.5),
      p90: percentile(endings, 0.9),
    },
    yearlyPercentiles: yearlyPercentilesOf(paths),
  }
}

function horizonOf(scenario: Scenario): number {
  return Math.max(...scenario.people.map((p) => p.planToAge - p.currentAge))
}

function runModel(scenario: Scenario, model: ReturnModel, tax: TaxModel): ModelResult {
  const years = horizonOf(scenario)
  const paths = model
    .paths(years, scenario.assumptions)
    .map((path) => simulate(scenario, path, tax))
  return summarize(model, paths)
}

export function run(scenario: Scenario, options: RunOptions = {}): Result {
  const tax = options.tax ?? new EffectiveRateTax(scenario.assumptions.effectiveTaxRate)

  const result: Result = {
    fixed: runModel(scenario, new FixedReturn(), tax),
  }

  for (const model of options.models ?? []) {
    const summary = runModel(scenario, model, tax)
    if (model.name === 'monte-carlo') result.monteCarlo = summary
    if (model.name === 'historical') result.historical = summary
  }

  return result
}

/**
 * The headline question, answered from the deterministic path: does the money
 * last through the plan, and if not, at what age does it run out.
 */
export function readiness(result: Result): {
  lasts: boolean
  depletedAtAge?: number
  endingBalance: Dollars
} {
  const path = result.fixed.paths[0]!
  return {
    lasts: path.succeeded,
    ...(path.depletedAtAge !== undefined ? { depletedAtAge: path.depletedAtAge } : {}),
    endingBalance: path.endingBalance,
  }
}
