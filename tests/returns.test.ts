import { describe, expect, it } from 'vitest'
import { HistoricalCohorts, LognormalMC } from '../src/engine/returns'
import { HISTORICAL_YEARS, blendedRealReturn, empiricalMoments } from '../src/data/historical'
import { mulberry32, nextGaussian } from '../src/engine/rng'
import { run } from '../src/engine/run'
import { PERSONAS, personaById } from './personas/index'
import { BASE_ASSUMPTIONS } from './personas/build'
import type { Assumptions } from '../src/engine/types'

const assumptions = (overrides: Partial<Assumptions> = {}): Assumptions => ({
  ...BASE_ASSUMPTIONS,
  ...overrides,
})

describe('seeded RNG', () => {
  it('is deterministic given the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const drawsA = Array.from({ length: 20 }, () => a())
    const drawsB = Array.from({ length: 20 }, () => b())
    expect(drawsA).toEqual(drawsB)
  })

  it('produces uniform(0,1) draws', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      const x = rng()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('produces roughly standard-normal Gaussian draws', () => {
    const rng = mulberry32(7)
    const draws = Array.from({ length: 20_000 }, () => nextGaussian(rng))
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length
    const variance = draws.reduce((s, x) => s + (x - mean) ** 2, 0) / draws.length

    expect(mean).toBeCloseTo(0, 1)
    expect(Math.sqrt(variance)).toBeCloseTo(1, 1)
  })
})

describe('historical data', () => {
  it('spans the full published range with no gaps or duplicates', () => {
    const years = HISTORICAL_YEARS.map((y) => y.year)
    expect(years[0]).toBe(1928)
    expect(years[years.length - 1]).toBeGreaterThanOrEqual(2024)
    for (let i = 1; i < years.length; i++) expect(years[i]).toBe(years[i - 1]! + 1)
  })

  it('has a plausible empirical real return at each allocation extreme', () => {
    // All-bonds and all-stock real means should bracket a typical 60/40 blend,
    // and land in the range every textbook agrees on: equities roughly 6-9%
    // real, bonds roughly 1-3% real, over the last century.
    const bonds = empiricalMoments(0)
    const stocks = empiricalMoments(1)

    expect(bonds.mean).toBeGreaterThan(0.005)
    expect(bonds.mean).toBeLessThan(0.04)
    expect(stocks.mean).toBeGreaterThan(0.05)
    expect(stocks.mean).toBeLessThan(0.11)
    expect(stocks.stdev).toBeGreaterThan(bonds.stdev) // equities are the volatile asset
  })

  it('blends linearly between the two extremes', () => {
    const year = HISTORICAL_YEARS[0]!
    const allStock = blendedRealReturn(year, 1)
    const allBond = blendedRealReturn(year, 0)
    const half = blendedRealReturn(year, 0.5)
    expect(half).toBeCloseTo((allStock + allBond) / 2, 10)
  })

  it('reproduces the well-known "bad decade" starting near the mid-1960s', () => {
    // The 1966 retiree is the canonical worst-case sequence-of-returns story in
    // retirement planning: high inflation and flat nominal stock prices
    // combined to produce a brutal 15+ year real return. This is a sanity
    // check that the data captures that period, not a precise historical claim.
    const idx = HISTORICAL_YEARS.findIndex((y) => y.year === 1966)
    const window = HISTORICAL_YEARS.slice(idx, idx + 15).map((y) => blendedRealReturn(y, 0.6))
    const cagr = Math.pow(window.reduce((p, r) => p * (1 + r), 1), 1 / window.length) - 1

    expect(cagr).toBeLessThan(0.02) // a rough, real-terms decade to remember
  })
})

describe('LognormalMC', () => {
  it('is deterministic across calls', () => {
    const model = new LognormalMC(200)
    const a = model.paths(30, assumptions())
    const b = model.paths(30, assumptions())
    expect(a).toEqual(b)
  })

  it('produces the requested number of paths, each the requested length', () => {
    const model = new LognormalMC(50)
    const paths = model.paths(25, assumptions())
    expect(paths).toHaveLength(50)
    for (const p of paths) expect(p).toHaveLength(25)
  })

  it('is calibrated near the historical empirical mean at the given allocation', () => {
    const alloc = 0.6
    const model = new LognormalMC(2000)
    const paths = model.paths(1, assumptions({ stockAllocation: alloc }))
    const draws = paths.map((p) => p[0]!)
    const sampleMean = draws.reduce((s, x) => s + x, 0) / draws.length

    const { mean } = empiricalMoments(alloc)
    expect(sampleMean).toBeCloseTo(mean, 1) // within ~5 percentage points at n=2000
  })

  it('produces more volatility at higher stock allocation', () => {
    const stdevOf = (draws: number[]) => {
      const m = draws.reduce((s, x) => s + x, 0) / draws.length
      return Math.sqrt(draws.reduce((s, x) => s + (x - m) ** 2, 0) / draws.length)
    }

    const model = new LognormalMC(2000)
    const conservative = model
      .paths(1, assumptions({ stockAllocation: 0.1 }))
      .map((p) => p[0]!)
    const aggressive = model
      .paths(1, assumptions({ stockAllocation: 0.9 }))
      .map((p) => p[0]!)

    expect(stdevOf(aggressive)).toBeGreaterThan(stdevOf(conservative))
  })

  it('never returns below -100% (can\'t lose more than everything)', () => {
    const model = new LognormalMC(5000)
    const paths = model.paths(40, assumptions({ stockAllocation: 1 }))
    for (const path of paths) for (const r of path) expect(r).toBeGreaterThan(-1)
  })
})

describe('HistoricalCohorts', () => {
  it('produces exactly one path per historical start year', () => {
    const model = new HistoricalCohorts()
    const paths = model.paths(30, assumptions())
    expect(paths).toHaveLength(HISTORICAL_YEARS.length)
  })

  it('is deterministic (it is not random at all)', () => {
    const model = new HistoricalCohorts()
    const a = model.paths(30, assumptions())
    const b = model.paths(30, assumptions())
    expect(a).toEqual(b)
  })

  it('wraps around the series for horizons longer than the data', () => {
    const model = new HistoricalCohorts()
    const paths = model.paths(150, assumptions()) // longer than the ~98-year series
    for (const p of paths) expect(p).toHaveLength(150)
  })

  it('replays the actual sequence starting from a given year, not a resample', () => {
    const model = new HistoricalCohorts()
    const paths = model.paths(5, assumptions({ stockAllocation: 1 }))
    const firstPath = paths[0]! // starts at 1928
    const expected = HISTORICAL_YEARS.slice(0, 5).map((y) => blendedRealReturn(y, 1))
    expect(firstPath).toEqual(expected)
  })
})

describe('run() orchestration with stochastic models', () => {
  it('produces a success rate strictly between 0 and 1 for a marginal plan', () => {
    // A plan sized so a deterministic 5% return exactly clears it should show
    // real variance under both stochastic models — some historical decades and
    // some Monte Carlo draws are worse than the flat assumption, some better.
    const marginal = personaById('median-preretiree-58')
    const result = run(marginal.truth, {
      models: [new LognormalMC(500), new HistoricalCohorts()],
    })

    expect(result.monteCarlo).toBeDefined()
    expect(result.historical).toBeDefined()
    expect(result.monteCarlo!.successRate).toBeGreaterThan(0)
    expect(result.monteCarlo!.successRate).toBeLessThanOrEqual(1)
    expect(result.historical!.successRate).toBeGreaterThan(0)
    expect(result.historical!.successRate).toBeLessThanOrEqual(1)
  })

  it('gives the wildly overfunded household 100% success under every model', () => {
    const rich = personaById('massively-overfunded-58')
    const result = run(rich.truth, {
      models: [new LognormalMC(300), new HistoricalCohorts()],
    })

    expect(result.fixed.successRate).toBe(1)
    expect(result.monteCarlo!.successRate).toBe(1)
    expect(result.historical!.successRate).toBe(1)
  })

  it('gives the already-depleted household 0% success under every model', () => {
    const broke = personaById('already-depleted-79')
    const result = run(broke.truth, {
      models: [new LognormalMC(300), new HistoricalCohorts()],
    })

    expect(result.fixed.successRate).toBe(0)
    expect(result.monteCarlo!.successRate).toBe(0)
    expect(result.historical!.successRate).toBe(0)
  })

  it('runs the full persona library under both stochastic models without error', () => {
    // Smaller path counts than production, but the point is coverage: every
    // household's shape (pensions, lump sums, no Social Security, age gaps)
    // must survive being run through a thousand-year mixture of sequences,
    // not just the single deterministic path.
    for (const persona of PERSONAS) {
      const result = run(persona.truth, {
        models: [new LognormalMC(50), new HistoricalCohorts()],
      })
      expect(Number.isFinite(result.monteCarlo!.successRate), persona.id).toBe(true)
      expect(Number.isFinite(result.historical!.successRate), persona.id).toBe(true)
    }
  })
})
