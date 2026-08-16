import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { Result } from '../../engine/types'
import { formatDollarsCompact, formatPercent } from '../format'
import { InfoTip } from './Field'
import { BalanceChart } from './Chart'
import { LedgerTable } from './LedgerTable'

interface ResultPanelProps {
  result: Result
  startAge: number
  /** The user's assumed real return — needed here only so the headline
   *  sentence states the actual assumption instead of a hardcoded one. */
  realReturn: number
}

const MODEL_INFO = {
  fixed:
    'Assumes markets return exactly the same rate every single year, after inflation — no crashes, no booms. It is not a prediction of what will happen; it is a clean baseline for comparing choices, because it isolates the effect of your inputs from the effect of market luck.',
  monteCarlo:
    "We ran your plan through 1,000 randomly generated market futures. Each one draws a different year-by-year sequence of stock and bond returns from a distribution calibrated to match how volatile markets have actually been — some paths look like steady growth, others front-load a crash early in retirement, which is the riskiest time for one to happen. The percentage is how many of those 1,000 futures your money lasted through.",
  historical:
    "Instead of random numbers, this replays what markets actually did. Your plan is run starting in 1928, then 1929, then 1930, and so on through 2025, using the real historical sequence of returns and inflation from each starting year. It's the harshest, most honest test available: if your plan survives the person who retired into the 1929 crash or the 1966 stagflation stretch, it can survive nearly anything the future plausibly holds.",
  percentiles:
    'These show how the ending balance varies across those 1,000 simulated — or ~100 historical — outcomes, sorted worst to best. The 10th percentile is a rough worst case: only 1 in 10 outcomes ended lower. The 90th percentile is a rough best case. The 50th percentile (the median) is the typical outcome — half did better, half did worse.',
} as const

function PercentileRange({ percentiles }: { percentiles: { p10: number; p50: number; p90: number } }): JSX.Element {
  return (
    <div class="result-stat-range">
      <span class="result-stat-range-label">Ending balance</span>
      <strong>{formatDollarsCompact(percentiles.p10)}</strong>
      <span class="result-stat-range-sep">to</span>
      <strong>{formatDollarsCompact(percentiles.p90)}</strong>
      <span class="result-stat-range-note">
        (typically {formatDollarsCompact(percentiles.p50)})
      </span>
    </div>
  )
}

export function ResultPanel({ result, startAge, realReturn }: ResultPanelProps): JSX.Element {
  const [showLedger, setShowLedger] = useState(false)
  const [showMethodology, setShowMethodology] = useState(false)
  const path = result.fixed.paths[0]!
  const lasts = path.succeeded

  return (
    <section class="result">
      <div class={`result-headline ${lasts ? 'result-headline--good' : 'result-headline--bad'}`}>
        <div class="result-verdict">{lasts ? 'On track' : 'Not there yet'}</div>
        <div class="result-detail">
          {lasts ? (
            <>
              At a steady {formatPercent(realReturn, 1)} real return, your plan leaves{' '}
              <strong>{formatDollarsCompact(path.endingBalance)}</strong> at the end of your plan.
            </>
          ) : (
            <>
              At a steady {formatPercent(realReturn, 1)} real return, the money runs out around{' '}
              <strong>age {path.depletedAtAge}</strong>.
            </>
          )}
          <InfoTip text={MODEL_INFO.fixed} />
        </div>
      </div>

      <div class="result-stats">
        {result.monteCarlo && (
          <div class="result-stat">
            <div class="result-stat-value">{formatPercent(result.monteCarlo.successRate)}</div>
            <div class="result-stat-label">
              of simulated markets, this plan holds up
              <InfoTip text={MODEL_INFO.monteCarlo} />
            </div>
            <PercentileRange percentiles={result.monteCarlo.percentiles} />
          </div>
        )}
        {result.historical && (
          <div class="result-stat">
            <div class="result-stat-value">{formatPercent(result.historical.successRate)}</div>
            <div class="result-stat-label">
              of real 1928–2025 historical windows this plan would have survived
              <InfoTip text={MODEL_INFO.historical} />
            </div>
            <PercentileRange percentiles={result.historical.percentiles} />
          </div>
        )}
      </div>

      <BalanceChart ledger={path.ledger} startAge={startAge} />

      <button
        type="button"
        class="section-toggle"
        onClick={() => setShowMethodology((v) => !v)}
      >
        {showMethodology ? 'Hide how these numbers work' : 'How these numbers are calculated'}
      </button>
      {showMethodology && (
        <div class="methodology">
          <div class="methodology-item">
            <h3>Steady return</h3>
            <p>{MODEL_INFO.fixed}</p>
          </div>
          <div class="methodology-item">
            <h3>Simulated markets (Monte Carlo)</h3>
            <p>{MODEL_INFO.monteCarlo}</p>
          </div>
          <div class="methodology-item">
            <h3>Real historical windows</h3>
            <p>{MODEL_INFO.historical}</p>
          </div>
          <div class="methodology-item">
            <h3>What the percentile range means</h3>
            <p>{MODEL_INFO.percentiles}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        class="section-toggle"
        onClick={() => setShowLedger((v) => !v)}
      >
        {showLedger ? 'Hide year-by-year detail' : 'Show year-by-year detail'}
      </button>
      {showLedger && <LedgerTable ledger={path.ledger} startAge={startAge} />}
    </section>
  )
}
