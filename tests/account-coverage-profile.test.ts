import { describe, it } from 'vitest'
import type { AccountKind } from '../src/engine/types'
import { PERSONAS, RAW_WEIGHT_SUM, WEIGHTS } from './personas/index'

/**
 * Not assertions — a readout, the same pattern as library-profile.test.ts.
 * Prints how account-kind ownership is distributed across the persona
 * library so it can be checked against real distributions rather than
 * assumed correct because narratives sound plausible.
 *
 * Run with: npm run audit-accounts
 */

const weightWhere = (pred: (p: (typeof PERSONAS)[number]) => boolean) =>
  PERSONAS.filter(pred).reduce((sum, p) => sum + (WEIGHTS.get(p.id) ?? 0), 0)

describe('account ownership profile', () => {
  it('prints coverage by account kind and combination', () => {
    const lines: string[] = ['']
    const kinds: AccountKind[] = ['taxable', 'pretax', 'roth', 'hsa']

    lines.push(`  raw weight sum: ${RAW_WEIGHT_SUM.toFixed(3)}`)
    lines.push('')
    lines.push('  ACCOUNT KIND COVERAGE (weighted) vs. 2022 SCF reference')
    lines.push('  ' + '─'.repeat(60))
    const reference: Partial<Record<AccountKind, string>> = {
      pretax: '~54% hold any retirement account (pretax+roth combined)',
      roth: '(counted within the 54% retirement-account figure)',
      taxable: '~21% hold stock directly outside retirement accounts',
      hsa: 'no single authoritative figure; ~15-20% of workers is a reasonable estimate',
    }
    for (const k of kinds) {
      const w = weightWhere((p) => p.truth.accounts.some((a) => a.kind === k))
      const count = PERSONAS.filter((p) => p.truth.accounts.some((a) => a.kind === k)).length
      lines.push(`    ${k.padEnd(10)} ${(w * 100).toFixed(1)}%  (${count} personas)`)
      lines.push(`      reference: ${reference[k]}`)
    }

    lines.push('')
    lines.push('  NO ACCOUNTS OF ANY TRACKED KIND')
    const none = weightWhere((p) => p.truth.accounts.length === 0)
    const noneCount = PERSONAS.filter((p) => p.truth.accounts.length === 0).length
    lines.push(`    ${(none * 100).toFixed(1)}%  (${noneCount} personas)`)
    lines.push('    reference: ~35-40% estimated (no retirement account AND no direct stock,')
    lines.push('    derived from the two SCF figures above; not itself an SCF line item)')

    lines.push('')
    lines.push('  ACCOUNT-KIND COMBINATIONS (weighted, sorted desc)')
    const comboWeight = new Map<string, number>()
    const comboCount = new Map<string, number>()
    for (const p of PERSONAS) {
      const combo = [...new Set(p.truth.accounts.map((a) => a.kind))].sort().join('+') || '(none)'
      comboWeight.set(combo, (comboWeight.get(combo) ?? 0) + (WEIGHTS.get(p.id) ?? 0))
      comboCount.set(combo, (comboCount.get(combo) ?? 0) + 1)
    }
    for (const [combo, w] of [...comboWeight.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${combo.padEnd(24)} ${(w * 100).toFixed(1)}%  (${comboCount.get(combo)} personas)`)
    }
    lines.push('')

    console.log(lines.join('\n'))
  })
})
