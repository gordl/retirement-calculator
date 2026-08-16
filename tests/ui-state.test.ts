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
})
