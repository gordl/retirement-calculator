import type { Dollars, ModelResult, PathResult, Result, Scenario } from './types'
import type { ReturnModel } from './returns'
import type { TaxModel } from './taxes'
import { FixedReturn } from './returns'
import { EffectiveRateTax } from './taxes'
import { simulate } from './ledger'

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
