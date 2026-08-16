import { describe, expect, it } from 'vitest'
import { exampleState, fromScenario, toScenario } from '../src/ui/state'
import { encode, decode } from '../src/url/codec'
import { run } from '../src/engine/run'

/**
 * Unit coverage for the pure conversion functions behind the UI —
 * `toScenario`/`fromScenario` — without needing a DOM. The component tree
 * itself was verified interactively in a real browser (live recalculation,
 * spending re-estimation, URL sync, the "not there yet" failure state); this
 * locks down the state <-> Scenario <-> URL chain those interactions depend on.
 */

describe('UI state conversions', () => {
  it('produces a runnable scenario from the example state', () => {
    const scenario = toScenario(exampleState())
    const result = run(scenario)
    expect(Number.isFinite(result.fixed.paths[0]!.endingBalance)).toBe(true)
  })

  it('round-trips example state through the URL codec', () => {
    const scenario = toScenario(exampleState())
    const decoded = decode(encode(scenario))
    expect(decoded).toEqual(scenario)
  })

  it('fromScenario(toScenario(s)) reconstructs an equivalent scenario', () => {
    // Not a byte-identical UIState round-trip (the UI state has strictly more
    // shape than Scenario — enabled flags, ss mode as a discriminant the user
    // picked) but the derived Scenario must match, since that's the only
    // thing that feeds the engine and the URL.
    const original = toScenario(exampleState())
    const rebuilt = toScenario(fromScenario(original))
    expect(rebuilt).toEqual(original)
  })

  it('omits a disabled account entirely from the scenario', () => {
    const state = exampleState()
    expect(state.accounts.roth.enabled).toBe(false)
    const scenario = toScenario(state)
    expect(scenario.accounts.find((a) => a.kind === 'roth')).toBeUndefined()
  })

  it('marks spending as touched once decoded from a URL, so it never silently re-estimates', () => {
    const scenario = toScenario(exampleState())
    const state = fromScenario(scenario)
    expect(state.spendingTouched).toBe(true)
  })

  describe('pensions', () => {
    it('omits a pension entirely when not enabled', () => {
      const scenario = toScenario(exampleState())
      expect(scenario.pensions).toEqual([])
    })

    it('omits a pension with an enabled checkbox but no amount entered', () => {
      const state = exampleState()
      state.primary.pensionEnabled = true
      state.primary.pensionAnnual = 0
      expect(toScenario(state).pensions).toEqual([])
    })

    it('includes an enabled pension with an amount, owned by the right person', () => {
      const state = exampleState()
      state.primary.pensionEnabled = true
      state.primary.pensionAnnual = 24_000
      state.primary.pensionStartAge = 65
      state.primary.pensionCola = true

      const pensions = toScenario(state).pensions
      expect(pensions).toHaveLength(1)
      expect(pensions[0]).toMatchObject({
        owner: 'primary',
        annual: 24_000,
        startAge: 65,
        cola: true,
      })
    })

    it('supports independent pensions for both people', () => {
      const state = exampleState()
      state.hasSpouse = true
      state.primary.pensionEnabled = true
      state.primary.pensionAnnual = 20_000
      state.spouse.pensionEnabled = true
      state.spouse.pensionAnnual = 15_000
      state.spouse.pensionCola = true

      const pensions = toScenario(state).pensions
      expect(pensions).toHaveLength(2)
      expect(pensions.find((p) => p.owner === 'primary')).toMatchObject({ annual: 20_000, cola: false })
      expect(pensions.find((p) => p.owner === 'spouse')).toMatchObject({ annual: 15_000, cola: true })
    })

    it('round-trips a pension through fromScenario(toScenario(s))', () => {
      const state = exampleState()
      state.primary.pensionEnabled = true
      state.primary.pensionAnnual = 30_000
      state.primary.pensionStartAge = 62
      state.primary.pensionCola = false

      const original = toScenario(state)
      const rebuilt = toScenario(fromScenario(original))
      expect(rebuilt).toEqual(original)
    })

    it('round-trips a pension through the URL codec', () => {
      const state = exampleState()
      state.primary.pensionEnabled = true
      state.primary.pensionAnnual = 18_500
      state.primary.pensionStartAge = 67
      state.primary.pensionCola = true

      const scenario = toScenario(state)
      const decoded = decode(encode(scenario))
      expect(decoded.pensions).toEqual(scenario.pensions)
    })
  })
})
