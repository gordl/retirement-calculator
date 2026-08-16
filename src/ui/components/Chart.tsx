import type { JSX } from 'preact'
import type { YearLedger } from '../../engine/types'

interface ChartProps {
  ledger: YearLedger[]
  startAge: number
}

const ACCOUNT_KINDS = ['taxable', 'pretax', 'roth', 'hsa'] as const

/** A hand-rolled SVG line chart of total portfolio balance over the plan,
 *  under the deterministic path. No charting library — two axes and one
 *  line don't need one, and it keeps the bundle tiny. */
export function BalanceChart({ ledger, startAge }: ChartProps): JSX.Element {
  const width = 640
  const height = 220
  const padding = { top: 12, right: 12, bottom: 24, left: 56 }

  const totals = ledger.map((y) => ACCOUNT_KINDS.reduce((s, k) => s + y.closing[k], 0))
  const maxValue = Math.max(1, ...totals)
  const n = ledger.length

  const x = (i: number) => padding.left + (i / Math.max(1, n - 1)) * (width - padding.left - padding.right)
  const y = (v: number) => height - padding.bottom - (v / maxValue) * (height - padding.top - padding.bottom)

  const linePath = totals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`

  const depletedIndex = ledger.findIndex((y) => y.shortfall > 1e-6)
  const gridValues = [0, maxValue / 2, maxValue]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="chart" role="img" aria-label="Projected portfolio balance over time">
      {gridValues.map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(v)}
            y2={y(v)}
            class="chart-gridline"
          />
          <text x={padding.left - 8} y={y(v)} class="chart-axis-label" text-anchor="end" dominant-baseline="middle">
            {v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}k`}
          </text>
        </g>
      ))}

      {[0, Math.floor(n / 2), n - 1].map((i) => (
        <text key={i} x={x(i)} y={height - 6} class="chart-axis-label" text-anchor="middle">
          age {startAge + i}
        </text>
      ))}

      <path d={areaPath} class="chart-area" />
      <path d={linePath} class="chart-line" />

      {depletedIndex >= 0 && (
        <line
          x1={x(depletedIndex)}
          x2={x(depletedIndex)}
          y1={padding.top}
          y2={height - padding.bottom}
          class="chart-depleted-line"
        />
      )}
    </svg>
  )
}
