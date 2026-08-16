import { useEffect, useMemo, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { run } from '../engine/run'
import { LognormalMC, HistoricalCohorts } from '../engine/returns'
import { decode, encode } from '../url/codec'
import {
  exampleState,
  fromScenario,
  recomputeSpendingEstimate,
  toScenario,
  type UIState,
} from './state'
import { Checkbox, NumberField, SelectField } from './components/Field'
import { ResultPanel } from './components/ResultPanel'

/**
 * Field order here is not a design guess — it follows tests/harness/sensitivity.ts
 * (`npm run rank-fields`), which measures how often each field actually
 * changes the readiness verdict across the weighted persona population.
 *
 * Tier 1 (always visible): salary, pre-tax balance, spending, retire age —
 *   the four highest flip-rate fields, plus current age, which is structural
 *   and always required regardless of its own ranking.
 * Tier 2 ("More about you"): spouse, pre-tax contribution, known Social
 *   Security, Roth/taxable balances — the next band down.
 * Tier 3 ("Advanced"): everything that measured near zero population impact
 *   — HSA, claim-age tuning, the return/tax/allocation assumptions. These
 *   exist for the households they matter to, without costing everyone else
 *   a field.
 */

function loadInitialState(): UIState {
  if (typeof window === 'undefined') return exampleState()
  const query = window.location.search.replace(/^\?/, '')
  if (!query) return exampleState()
  try {
    return fromScenario(decode(query))
  } catch {
    return exampleState()
  }
}

export function App(): JSX.Element {
  const [state, setState] = useState<UIState>(loadInitialState)

  const scenario = useMemo(() => toScenario(state), [state])

  const result = useMemo(
    () => run(scenario, { models: [new LognormalMC(400), new HistoricalCohorts()] }),
    [scenario],
  )

  useEffect(() => {
    const query = encode(scenario)
    const url = `${window.location.pathname}?${query}`
    window.history.replaceState(null, '', url)
  }, [scenario])

  const update = (patch: Partial<UIState>) =>
    setState((s) => {
      const next = { ...s, ...patch }
      if (!next.spendingTouched) next.spendingAnnual = recomputeSpendingEstimate(next)
      return next
    })

  const updateAccount = (kind: keyof UIState['accounts'], patch: Partial<UIState['accounts'][typeof kind]>) =>
    update({ accounts: { ...state.accounts, [kind]: { ...state.accounts[kind], ...patch } } })

  return (
    <main class="app">
      <header class="app-header">
        <h1>Retirement Readiness</h1>
        <p class="app-tagline">
          No account, no signup — this whole plan lives in the URL. Copy the link to save or
          share it.
        </p>
      </header>

      <ResultPanel result={result} startAge={state.primary.age} />

      <form class="form" onSubmit={(e) => e.preventDefault()}>
        <section class="section">
          <h2>About you</h2>
          <div class="field-grid">
            <NumberField label="Your age" value={state.primary.age} min={18} max={99}
              onChange={(n) => update({ primary: { ...state.primary, age: n } })} />
            <NumberField label="Salary" value={state.primary.salary} step={1000} prefix="$"
              onChange={(n) => update({ primary: { ...state.primary, salary: n } })} />
            <NumberField label="Retirement age" value={state.primary.retireAge} min={state.primary.age} max={80}
              onChange={(n) => update({ primary: { ...state.primary, retireAge: n } })} />
            <NumberField label="401(k)/IRA balance" value={state.accounts.pretax.balance} step={1000} prefix="$"
              hint="Traditional 401(k), 403(b), or IRA"
              onChange={(n) => updateAccount('pretax', { enabled: true, balance: n })} />
          </div>
          <div class="field-grid">
            <NumberField
              label="Annual spending in retirement"
              value={state.spendingAnnual}
              step={1000}
              prefix="$"
              hint={state.spendingTouched ? undefined : 'Estimated from your income — edit if you know your number'}
              onChange={(n) => update({ spendingAnnual: n, spendingTouched: true })}
            />
          </div>
        </section>

        <button
          type="button"
          class="section-toggle"
          onClick={() => update({ showMore: !state.showMore })}
        >
          {state.showMore ? 'Hide more detail' : 'More about you'}
        </button>

        {state.showMore && (
          <section class="section">
            <Checkbox
              label="I have a spouse or partner in this plan"
              checked={state.hasSpouse}
              onChange={(hasSpouse) => update({ hasSpouse })}
            />
            {state.hasSpouse && (
              <div class="field-grid">
                <NumberField label="Spouse's age" value={state.spouse.age} min={18} max={99}
                  onChange={(n) => update({ spouse: { ...state.spouse, age: n } })} />
                <NumberField label="Spouse's salary" value={state.spouse.salary} step={1000} prefix="$"
                  onChange={(n) => update({ spouse: { ...state.spouse, salary: n } })} />
                <NumberField label="Spouse's retirement age" value={state.spouse.retireAge} min={state.spouse.age} max={80}
                  onChange={(n) => update({ spouse: { ...state.spouse, retireAge: n } })} />
              </div>
            )}

            <div class="field-grid">
              <NumberField label="401(k)/IRA contribution" value={state.accounts.pretax.contribution} step={500} prefix="$"
                hint="Your contribution plus any employer match, per year"
                onChange={(n) => updateAccount('pretax', { contribution: n })} />
              <NumberField label="Roth IRA/401(k) balance" value={state.accounts.roth.balance} step={1000} prefix="$"
                onChange={(n) => updateAccount('roth', { enabled: true, balance: n })} />
              <NumberField label="Brokerage/savings balance" value={state.accounts.taxable.balance} step={1000} prefix="$"
                onChange={(n) => updateAccount('taxable', { enabled: true, balance: n })} />
            </div>

            <SelectField
              label="Do you know your Social Security benefit?"
              value={state.primary.ssMode}
              options={[
                { value: 'auto', label: "No — estimate it from my salary" },
                { value: 'manual', label: 'Yes — I know my monthly amount' },
                { value: 'none', label: "I won't receive Social Security" },
              ]}
              onChange={(ssMode) => update({ primary: { ...state.primary, ssMode } })}
            />
            {state.primary.ssMode === 'manual' && (
              <NumberField
                label="Monthly benefit at full retirement age"
                value={state.primary.ssMonthly}
                step={50}
                prefix="$"
                onChange={(n) => update({ primary: { ...state.primary, ssMonthly: n } })}
              />
            )}
          </section>
        )}

        <button
          type="button"
          class="section-toggle"
          onClick={() => update({ showAdvanced: !state.showAdvanced })}
        >
          {state.showAdvanced ? 'Hide advanced' : 'Advanced'}
        </button>

        {state.showAdvanced && (
          <section class="section">
            <div class="field-grid">
              <NumberField label="HSA balance" value={state.accounts.hsa.balance} step={500} prefix="$"
                onChange={(n) => updateAccount('hsa', { enabled: true, balance: n })} />
              <NumberField label="Plan to age" value={state.primary.planToAge} min={state.primary.age + 1} max={105}
                onChange={(n) => update({ primary: { ...state.primary, planToAge: n } })} />
              <NumberField label="Your Social Security claim age" value={state.primary.ssClaimAge} min={62} max={70}
                onChange={(n) => update({ primary: { ...state.primary, ssClaimAge: n } })} />
            </div>
            <div class="field-grid">
              <NumberField label="Assumed real return" value={Math.round(state.realReturn * 1000) / 10} step={0.1} suffix="%"
                onChange={(n) => update({ realReturn: n / 100 })} />
              <NumberField label="Stock allocation" value={Math.round(state.stockAllocation * 100)} step={5} suffix="%"
                onChange={(n) => update({ stockAllocation: n / 100 })} />
              <NumberField label="Effective tax rate" value={Math.round(state.effectiveTaxRate * 100)} step={1} suffix="%"
                onChange={(n) => update({ effectiveTaxRate: n / 100 })} />
            </div>
            <SelectField
              label="Spending pattern"
              value={state.spendingPath}
              options={[
                { value: 'flat', label: 'Flat (constant real spending)' },
                { value: 'retirement-smile', label: 'Retirement smile (active early, tapering later)' },
              ]}
              onChange={(spendingPath) => update({ spendingPath })}
            />
          </section>
        )}
      </form>

      <footer class="app-footer">
        This is a modeling tool, not financial advice. Talk to a licensed advisor before making
        retirement decisions.
      </footer>
    </main>
  )
}
