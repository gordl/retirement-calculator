import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { Result } from '../../engine/types'
import { formatDollarsCompact, formatPercent } from '../format'
import { BalanceChart } from './Chart'
import { LedgerTable } from './LedgerTable'

interface ResultPanelProps {
  result: Result
  startAge: number
}

export function ResultPanel({ result, startAge }: ResultPanelProps): JSX.Element {
  const [showLedger, setShowLedger] = useState(false)
  const path = result.fixed.paths[0]!
  const lasts = path.succeeded

  return (
    <section class="result">
      <div class={`result-headline ${lasts ? 'result-headline--good' : 'result-headline--bad'}`}>
        <div class="result-verdict">{lasts ? 'On track' : 'Not there yet'}</div>
        <div class="result-detail">
          {lasts ? (
            <>
              At a steady 5% real return, your plan leaves{' '}
              <strong>{formatDollarsCompact(path.endingBalance)}</strong> at the end of your plan.
            </>
          ) : (
            <>
              At a steady 5% real return, the money runs out around{' '}
              <strong>age {path.depletedAtAge}</strong>.
            </>
          )}
        </div>
      </div>

      <div class="result-stats">
        {result.monteCarlo && (
          <div class="result-stat">
            <div class="result-stat-value">{formatPercent(result.monteCarlo.successRate)}</div>
            <div class="result-stat-label">of simulated markets, this plan holds up</div>
          </div>
        )}
        {result.historical && (
          <div class="result-stat">
            <div class="result-stat-value">{formatPercent(result.historical.successRate)}</div>
            <div class="result-stat-label">
              of real 1928–2025 historical windows this plan would have survived
            </div>
          </div>
        )}
      </div>

      <BalanceChart ledger={path.ledger} startAge={startAge} />

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
