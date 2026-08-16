import { describe, expect, it } from 'vitest'
import { rankFields } from './harness/sensitivity'

/**
 * Grades the ranking itself, not any particular field's exact position.
 *
 * The ranking (npm run rank-fields) is what phase 5's UI ordering is built
 * from — high information-value fields get asked first, low-value fields get
 * demoted behind progressive disclosure or dropped to a sensible default
 * entirely. These assertions are loose on purpose: the point is to catch the
 * ranking becoming nonsensical (a structural mistake in a defaulter, a field
 * that never applies to anyone), not to pin exact percentages that would make
 * this test brittle against every future persona-library edit.
 */

describe('field sensitivity ranking', () => {
  const ranking = rankFields()

  it('measures every ranked field', () => {
    expect(ranking.length).toBeGreaterThan(15)
  })

  it('finds every field applicable to at least some of the population', () => {
    // A defaulter that never fires for anyone is either dead code or a bug —
    // e.g. comparing against the wrong default so `applies` is always false.
    for (const f of ranking) {
      expect(f.applicability, f.field).toBeGreaterThan(0)
    }
  })

  it('ranks spending above the individual account-assumption fields', () => {
    // Justifies estimating spending rather than treating it as just another
    // field — it should visibly outrank at least the least-important
    // assumption knobs.
    const spending = ranking.find((f) => f.field === 'spending.annual')!
    const leastImportant = ranking[ranking.length - 1]!
    expect(spending.flipRate).toBeGreaterThanOrEqual(leastImportant.flipRate)
  })

  it('ranks at least one account balance field above assumption fields', () => {
    // Portfolio size should matter more to the yes/no verdict than tweaking
    // the tax-rate or stock-allocation assumption — those shift the answer at
    // the margin, balances often decide it outright.
    const balances = ranking.filter((f) => f.field.startsWith('accounts.') && f.field.endsWith('.balance'))
    const bestBalance = balances.reduce((best, f) => (f.flipRate > best.flipRate ? f : best))
    const assumptions = ranking.filter((f) => f.field.startsWith('assumptions.'))
    const worstAssumption = assumptions.reduce((worst, f) => (f.flipRate < worst.flipRate ? f : worst))
    expect(bestBalance.flipRate).toBeGreaterThanOrEqual(worstAssumption.flipRate)
  })

  it('gives every field a flip rate and magnitude within sane bounds', () => {
    for (const f of ranking) {
      expect(f.flipRate, f.field).toBeGreaterThanOrEqual(0)
      expect(f.flipRate, f.field).toBeLessThanOrEqual(1)
      expect(f.magnitude, f.field).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(f.magnitude), f.field).toBe(true)
    }
  })

  it('prints the ranking', () => {
    const lines: string[] = ['']
    lines.push('  FIELD INFORMATION VALUE (population-weighted)')
    lines.push('  ' + '─'.repeat(74))
    lines.push(
      '  ' +
        'field'.padEnd(30) +
        'flip rate'.padStart(11) +
        'magnitude'.padStart(11) +
        'applies to'.padStart(12),
    )
    for (const f of ranking) {
      lines.push(
        '  ' +
          f.field.padEnd(30) +
          `${(f.flipRate * 100).toFixed(1)}%`.padStart(11) +
          f.magnitude.toFixed(2).padStart(11) +
          `${(f.applicability * 100).toFixed(0)}%`.padStart(12),
      )
    }
    lines.push('')
    console.log(lines.join('\n'))
  })
})
