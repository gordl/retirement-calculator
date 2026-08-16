/** Formatting helpers shared across the UI. Kept dependency-free on purpose —
 *  Intl is built into every browser this app targets. */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatDollars(n: number): string {
  return currency.format(n)
}

/** Compact form for the big headline number: "$1.2M" rather than "$1,234,567". */
export function formatDollarsCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${Math.round(abs / 1_000)}k`
  return formatDollars(n)
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`
}
