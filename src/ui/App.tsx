import { useEffect, useMemo, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { run } from '../engine/run'
import { LognormalMC, HistoricalCohorts } from '../engine/returns'
import { estimatedBenefit } from '../engine/socialsecurity'
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
import { formatDollars } from './format'

const ACCOUNT_INFO = {
  pretax:
    'A traditional 401(k), 403(b), or IRA. Contributions were never taxed going in — the full withdrawal, contributions plus all growth, is taxed as ordinary income when you take it out.',
  roth: 'Contributions were already taxed before they went in. Growth is never taxed again, as long as withdrawals are qualified.',
  taxable:
    'An ordinary brokerage or savings account. Contributions were already taxed as income. Only the investment gain is taxed later, when you sell — see "cost basis" below.',
  hsa: 'A health savings account. Contributions are tax-free through payroll, and withdrawals are tax-free too, as long as they go toward medical expenses.',
} as const

const COST_BASIS_INFO =
  'What you originally put in, before any growth. Only the difference between your current balance and this figure is treated as a taxable gain when you withdraw. Leave it equal to your balance if you\'re not sure — that assumes no gain yet, which slightly understates future tax.'

/**
 * Shows the actual result of the Social Security calculation, not just the
 * inputs that drove it — the estimate is otherwise invisible to the user.
 * `null` means that person opted out (mode "none"), which is deliberately
 * rendered as nothing rather than "$0/mo" so it doesn't read as a bug.
 */
function SocialSecurityDetail({ people }: { people: import('../engine/types').Person[] }): JSX.Element | null {
  const rows = people
    .map((person) => ({ person, benefit: estimatedBenefit(person) }))
    .filter((r): r is { person: (typeof people)[number]; benefit: NonNullable<typeof r.benefit> } =>
      r.benefit !== null,
    )

  if (rows.length === 0) return null

  return (
    <div class="ss-detail">
      {rows.map(({ person, benefit }) => (
        <div class="ss-detail-row" key={person.id}>
          <span class="ss-detail-who">{person.id === 'spouse' ? 'Spouse' : 'You'}</span>
          <span class="ss-detail-numbers">
            {benefit.source === 'estimated' ? (
              <>
                Estimated at <strong>{formatDollars(benefit.monthlyAtFRA)}/mo</strong> at full
                retirement age
                {benefit.claimAge !== 67 && (
                  <>
                    {' '}
                    → <strong>{formatDollars(benefit.monthlyAtClaimAge)}/mo</strong> claiming at
                    age {benefit.claimAge}
                  </>
                )}
              </>
            ) : (
              <>
                <strong>{formatDollars(benefit.monthlyAtClaimAge)}/mo</strong> claiming at age{' '}
                {benefit.claimAge}
              </>
            )}
          </span>
        </div>
      ))}
      <span class="field-hint">
        {rows.some((r) => r.benefit.source === 'estimated')
          ? 'Estimated from salary and years worked using the SSA benefit formula — enter your real amount above if you know it.'
          : null}
      </span>
    </div>
  )
}

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
              info={ACCOUNT_INFO.pretax}
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
                info={ACCOUNT_INFO.roth}
                onChange={(n) => updateAccount('roth', { enabled: true, balance: n })} />
            </div>
            <div class="field-grid">
              <NumberField label="Brokerage/savings balance" value={state.accounts.taxable.balance} step={1000} prefix="$"
                info={ACCOUNT_INFO.taxable}
                onChange={(n) => {
                  const t = state.accounts.taxable
                  updateAccount('taxable', {
                    enabled: true,
                    balance: n,
                    // Track the balance until the user deliberately sets a
                    // different cost basis — see COST_BASIS_INFO.
                    ...(t.costBasisTouched ? {} : { costBasis: n }),
                  })
                }} />
              {state.accounts.taxable.balance > 0 && (
                <NumberField label="Cost basis" value={state.accounts.taxable.costBasis} step={1000} prefix="$"
                  hint="What you originally put in — only the gain above this is taxed"
                  info={COST_BASIS_INFO}
                  onChange={(n) => updateAccount('taxable', { costBasis: n, costBasisTouched: true })} />
              )}
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
            <SocialSecurityDetail people={scenario.people} />
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
                info={ACCOUNT_INFO.hsa}
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
