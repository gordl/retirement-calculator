import { describe, it } from 'vitest'
import { PERSONAS, WEIGHTS, weightedMean, weightedPercentile } from './personas/index'
import type { Persona } from './personas/types'

/**
 * Not assertions — a readout. Prints what the persona library actually looks
 * like as a population, so it can be eyeballed against published SCF/SSA
 * figures rather than trusted because the weights were typed carefully.
 *
 * Run with:  npm run profile
 */

const savings = (p: Persona) => p.truth.accounts.reduce((s, a) => s + a.balance, 0)
const age = (p: Persona) => p.truth.people[0]!.currentAge
const income = (p: Persona) => p.truth.people.reduce((s, x) => s + x.salary, 0)
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

const weightWhere = (pred: (p: Persona) => boolean) =>
  PERSONAS.filter(pred).reduce((s, p) => s + (WEIGHTS.get(p.id) ?? 0), 0)

describe('persona library profile', () => {
  it('prints the population it represents', () => {
    const lines: string[] = []
    const say = (s = '') => lines.push(s)

    say()
    say(`  ${PERSONAS.length} personas, population-weighted`)
    say('  ' + '─'.repeat(58))

    say()
    say('  RETIREMENT SAVINGS (all accounts)')
    for (const q of [0.25, 0.5, 0.75, 0.9] as const) {
      say(`    p${(q * 100).toFixed(0).padStart(2)}  ${usd(weightedPercentile(PERSONAS, savings, q)).padStart(12)}`)
    }
    say(`    mean ${usd(weightedMean(PERSONAS, savings)).padStart(12)}`)

    say()
    say('  HOUSEHOLD INCOME')
    for (const q of [0.25, 0.5, 0.75] as const) {
      say(`    p${(q * 100).toFixed(0).padStart(2)}  ${usd(weightedPercentile(PERSONAS, income, q)).padStart(12)}`)
    }

    say()
    say('  AGE COHORTS (share of weight)')
    const cohorts: [string, (p: Persona) => boolean][] = [
      ['25-34', (p) => age(p) >= 25 && age(p) < 35],
      ['35-44', (p) => age(p) >= 35 && age(p) < 45],
      ['45-54', (p) => age(p) >= 45 && age(p) < 55],
      ['55-64', (p) => age(p) >= 55 && age(p) < 65],
      ['65-74', (p) => age(p) >= 65 && age(p) < 75],
      ['75+  ', (p) => age(p) >= 75],
    ]
    for (const [label, pred] of cohorts) {
      const w = weightWhere(pred)
      say(`    ${label}  ${pct(w).padStart(6)}  ${'█'.repeat(Math.round(w * 100))}`)
    }

    say()
    say('  SITUATIONS (share of weight)')
    const situations: [string, (p: Persona) => boolean][] = [
      ['under $25k saved     ', (p) => savings(p) < 25_000],
      ['married              ', (p) => p.truth.people.length === 2],
      ['has a pension        ', (p) => p.truth.pensions.length > 0],
      ['no Social Security   ', (p) => p.truth.people.some((x) => x.socialSecurity.mode === 'none')],
      ['already retired      ', (p) => p.truth.people.every((x) => x.salary === 0)],
      ['tier 2 (has gaps)    ', (p) => p.tier === 2],
    ]
    for (const [label, pred] of situations) {
      say(`    ${label} ${pct(weightWhere(pred)).padStart(6)}`)
    }

    say()
    say('  WHAT THEY CAN ANSWER WITHOUT LOOKING IT UP')
    const fields = [
      'primary.salary',
      'accounts.pretax.balance',
      'spending.annual',
      'primary.ss.monthlyAtFRA',
      'primary.retireAge',
    ] as const
    for (const f of fields) {
      const w = weightWhere((p) => p.knows.includes(f))
      say(`    ${f.padEnd(24)} ${pct(w).padStart(6)}  ${'█'.repeat(Math.round(w * 40))}`)
    }
    say(`    fields known, mean       ${weightedMean(PERSONAS, (p) => p.knows.length).toFixed(1)}`)

    say()
    say('  COVERAGE GAPS LOGGED')
    const gaps = PERSONAS.filter((p) => p.knownGaps?.length)
    say(`    ${gaps.length} personas, ${gaps.reduce((s, p) => s + (p.knownGaps?.length ?? 0), 0)} distinct gaps`)
    say()

    console.log(lines.join('\n'))
  })
})
