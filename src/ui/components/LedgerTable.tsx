import type { JSX } from 'preact'
import type { YearLedger } from '../../engine/types'
import { formatDollarsCompact } from '../format'

interface LedgerTableProps {
  ledger: YearLedger[]
  startAge: number
}

const ACCOUNT_KINDS = ['taxable', 'pretax', 'roth', 'hsa'] as const

const cell = (n: number) => (Math.abs(n) < 1 ? '—' : formatDollarsCompact(n))

/**
 * The year-by-year detail behind the chart and the headline number. Nothing
 * here is a new calculation — every column is a field already on `YearLedger`
 * — this just makes the ledger inspectable instead of trusting a single line
 * on a graph.
 */
export function LedgerTable({ ledger, startAge }: LedgerTableProps): JSX.Element {
  return (
    <div class="ledger-table-wrap">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Age</th>
            <th>Wages</th>
            <th>Soc. Sec.</th>
            <th>Pension</th>
            <th>Other</th>
            <th>Growth</th>
            <th>Spending</th>
            <th>Taxes</th>
            <th>Withdrawn</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((y) => {
            const withdrawn = ACCOUNT_KINDS.reduce((s, k) => s + y.withdrawals[k], 0)
            const balance = ACCOUNT_KINDS.reduce((s, k) => s + y.closing[k], 0)
            return (
              <tr key={y.year} class={y.shortfall > 1e-6 ? 'ledger-row--shortfall' : undefined}>
                <td>{startAge + y.year}</td>
                <td>{cell(y.wages)}</td>
                <td>{cell(y.socialSecurity)}</td>
                <td>{cell(y.pensionIncome)}</td>
                <td>{cell(y.otherIncome + y.lumpSums)}</td>
                <td>{cell(y.growth)}</td>
                <td>{cell(y.spendingNeed)}</td>
                <td>{cell(y.taxes)}</td>
                <td>{cell(withdrawn)}</td>
                <td class="ledger-cell-balance">{cell(balance)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
