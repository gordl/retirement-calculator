import type { JSX } from 'preact'
import type { YearLedger } from '../../engine/types'

interface ChartProps {
  ledger: YearLedger[]
  startAge: number
}

const ACCOUNT_KINDS = ['taxable', 'pretax', 'roth', 'hsa'] as const

interface Marker {
  index: number
  label: string
  variant: 'retire' | 'ss' | 'depleted'
}

/** Places labels so two markers landing close together don't overlap: the
 *  later one in the array drops to a lower text band. */
function layoutLabels(markers: Marker[], minGapIndex: number): Map<number, 0 | 1> {
  const bands = new Map<number, 0 | 1>()
  const placed: number[] = []
  for (const m of markers) {
    const collides = placed.some((i) => Math.abs(i - m.index) < minGapIndex)
    bands.set(m.index, collides ? 1 : 0)
    placed.push(m.index)
  }
  return bands
}

/** A hand-rolled SVG line chart of total portfolio balance over the plan,
 *  under the deterministic path. No charting library — two axes and one
 *  line don't need one, and it keeps the bundle tiny. */
export function BalanceChart({ ledger, startAge }: ChartProps): JSX.Element {
  const width = 640
  const height = 260
  const padding = { top: 34, right: 12, bottom: 24, left: 56 }

  const totals = ledger.map((y) => ACCOUNT_KINDS.reduce((s, k) => s + y.closing[k], 0))
  const maxValue = Math.max(1, ...totals)
  const n = ledger.length

  const x = (i: number) => padding.left + (i / Math.max(1, n - 1)) * (width - padding.left - padding.right)
  const y = (v: number) => height - padding.bottom - (v / maxValue) * (height - padding.top - padding.bottom)

  const linePath = totals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`

  const gridValues = [0, maxValue / 2, maxValue]

  // The three moments that actually explain the shape of the line: when
  // drawdown starts, when Social Security kicks in, and — if the plan
  // fails — the year it runs out. Everything else on the chart is scale.
  const retireIndex = ledger.findIndex((row) => row.spendingNeed > 0)
  const ssIndex = ledger.findIndex((row) => row.socialSecurity > 0)
  const depletedIndex = ledger.findIndex((row) => row.shortfall > 1e-6)

  const markers: Marker[] = []
  if (retireIndex > 0) markers.push({ index: retireIndex, label: 'Retire', variant: 'retire' })
  if (ssIndex >= 0 && ssIndex !== retireIndex) {
    markers.push({ index: ssIndex, label: 'Social Security starts', variant: 'ss' })
  }
  if (depletedIndex >= 0) {
    markers.push({ index: depletedIndex, label: 'Money runs out', variant: 'depleted' })
  }

  const bands = layoutLabels(markers, Math.max(2, Math.round(n * 0.12)))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="chart" role="img" aria-label="Projected portfolio balance over time, with retirement, Social Security, and depletion marked">
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

      {markers.map((m) => {
        const band = bands.get(m.index) ?? 0
        const labelY = padding.top - 22 + band * 12
        // Clamp the text anchor near the chart edges so labels don't clip.
        const nearLeft = x(m.index) < padding.left + 60
        const nearRight = x(m.index) > width - padding.right - 60
        const anchor = nearLeft ? 'start' : nearRight ? 'end' : 'middle'
        return (
          <g key={`${m.variant}-${m.index}`} class={`chart-marker chart-marker--${m.variant}`}>
            <line x1={x(m.index)} x2={x(m.index)} y1={padding.top} y2={height - padding.bottom} class="chart-marker-line" />
            <text x={x(m.index)} y={labelY} class="chart-marker-label" text-anchor={anchor}>
              {m.label} (age {startAge + m.index})
            </text>
          </g>
        )
      })}
    </svg>
  )
}
