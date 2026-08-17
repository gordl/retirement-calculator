import { useEffect, useMemo, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { run } from '../engine/run'
import { LognormalMC, HistoricalCohorts } from '../engine/returns'
import { estimatedBenefit } from '../engine/socialsecurity'
import { decode, encode } from '../url/codec'
import {
  blankExpense,
  blankIncome,
  blankLumpSum,
  exampleState,
  fromScenario,
  recomputeSpendingEstimate,
  toScenario,
  type ExpenseItemState,
  type IncomeItemState,
  type LumpSumItemState,
  type SectionName,
  type UIState,
} from './state'
import { Checkbox, NumberField, SelectField } from './components/Field'
import { ExpenseFields, IncomeFields, LumpSumFields } from './components/ListFields'
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

const PRE_RETIREMENT_INFO =
  "Left blank, the plan assumes your income covers your spending while you're working, so only your stated contributions build the portfolio. Fill it in and the plan does the real arithmetic: anything left over after tax, spending and contributions gets saved, and any shortfall comes out of the portfolio — which is how you'd see a household outspending its income today."

/**
 * A starting figure for pre-retirement spending: income after tax and
 * contributions, which is what the plan implicitly assumes while the field
 * is off. Matches the ledger's own arithmetic, employer match included,
 * so the first working year starts at roughly break-even.
 *
 * Note this does *not* leave the projection unchanged. Once a budget exists,
 * real wage growth above flat real spending produces a surplus that gets
 * saved — where previously it was discarded. The ending balance generally
 * rises, and that difference is the point of the feature, not a glitch.
 */
function suggestedPreRetirementSpending(state: UIState): number {
  const wages =
    state.primary.salary + (state.hasSpouse ? state.spouse.salary : 0)
  const contributions =
    state.accounts.pretax.contribution +
    state.accounts.pretax.employerMatch +
    state.accounts.roth.contribution +
    state.accounts.taxable.contribution +
    state.accounts.hsa.contribution
  const afterTax = wages * (1 - state.effectiveTaxRate)
  return Math.max(0, Math.round((afterTax - contributions) / 1000) * 1000)
}

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

interface SectionToggleProps {
  name: SectionName
  label: string
  /** One line naming what's inside, so a section can be skipped without
   *  opening it — the whole point of collapsing them in the first place. */
  summary: string
  state: UIState
  onToggle: (name: SectionName) => void
}

function SectionToggle({ name, label, summary, state, onToggle }: SectionToggleProps): JSX.Element {
  const open = state.open[name]
  return (
    <button
      type="button"
      class={`section-toggle ${open ? 'section-toggle--open' : ''}`}
      aria-expanded={open}
      onClick={() => onToggle(name)}
    >
      <span class="section-toggle-label">{label}</span>
      <span class="section-toggle-summary">{summary}</span>
      <span class="section-toggle-chevron" aria-hidden="true">
        {open ? '−' : '+'}
      </span>
    </button>
  )
}

interface PensionFieldsProps {
  label: string
  startAgeMin: number
  person: import('./state').PersonState
  onChange: (patch: Partial<import('./state').PersonState>) => void
}

/** A defined-benefit pension: amount, when it starts, and whether it keeps
 *  pace with inflation. One per person — see the note on fromPerson in
 *  state.ts for the (rare) case that doesn't cover. */
function PensionFields({ label, startAgeMin, person, onChange }: PensionFieldsProps): JSX.Element {
  return (
    <>
      <Checkbox
        label={label}
        checked={person.pensionEnabled}
        onChange={(pensionEnabled) => onChange({ pensionEnabled })}
      />
      {person.pensionEnabled && (
        <>
          <div class="field-grid">
            <NumberField
              label="Annual pension amount"
              value={person.pensionAnnual}
              step={1000}
              prefix="$"
              onChange={(n) => onChange({ pensionAnnual: n })}
            />
            <NumberField
              label="Pension start age"
              value={person.pensionStartAge}
              min={startAgeMin}
              max={80}
              onChange={(n) => onChange({ pensionStartAge: n })}
            />
          </div>
          <Checkbox
            label="Adjusts for inflation (COLA) — most public pensions do, most private ones don't"
            checked={person.pensionCola}
            onChange={(pensionCola) => onChange({ pensionCola })}
          />
        </>
      )}
    </>
  )
}

/**
 * Form structure.
 *
 * "About you" stays always-visible and holds the five highest-value fields
 * per tests/harness/sensitivity.ts (`npm run rank-fields`): age, salary,
 * retirement age, pre-tax balance, spending. That ranking still governs what
 * earns a place on the first screen.
 *
 * Everything below it is grouped by *what it is* rather than by how advanced
 * it is. The previous "More about you" / "Advanced" split was a ranking
 * applied to whole sections, and it produced an incoherent result: irregular
 * expenses sat two clicks closer than one-time amounts, even though one-time
 * amounts apply to more households (32% vs 24%) — and "Advanced" mixed
 * genuine assumptions nobody knows (return, tax rate) with plain facts about
 * a household (rental income, an inheritance).
 *
 * The four sections now are:
 *   Household & savings   — spouse, contributions, the other account balances
 *   Income in retirement  — Social Security, pensions, other regular income
 *   Expenses & one-time   — time-bounded costs, and money landing in one year
 *   Assumptions           — only the knobs nobody can actually know
 *
 * Each carries a one-line summary so a section can be skipped without being
 * opened, which is what keeps the friction budget intact despite there being
 * more sections than before.
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

  const addIncome = () => update({ incomes: [...state.incomes, blankIncome(state.primary.retireAge)] })
  const updateIncome = (id: string, patch: Partial<IncomeItemState>) =>
    update({ incomes: state.incomes.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const removeIncome = (id: string) => update({ incomes: state.incomes.filter((i) => i.id !== id) })

  const addExpense = () => update({ expenses: [...state.expenses, blankExpense(state.primary.retireAge)] })
  const updateExpense = (id: string, patch: Partial<ExpenseItemState>) =>
    update({ expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const removeExpense = (id: string) => update({ expenses: state.expenses.filter((e) => e.id !== id) })

  const addLumpSum = () => update({ lumpSums: [...state.lumpSums, blankLumpSum(state.primary.retireAge)] })
  const updateLumpSum = (id: string, patch: Partial<LumpSumItemState>) =>
    update({ lumpSums: state.lumpSums.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  const removeLumpSum = (id: string) => update({ lumpSums: state.lumpSums.filter((l) => l.id !== id) })

  const toggleSection = (name: SectionName) =>
    update({ open: { ...state.open, [name]: !state.open[name] } })

  return (
    <main class="app">
      <header class="app-header">
        <h1>Retirement Readiness</h1>
        <p class="app-tagline">
          No account, no signup — this whole plan lives in the URL. Copy the link to save or
          share it.
        </p>
      </header>

      <ResultPanel
        result={result}
        startAge={state.primary.age}
        realReturn={state.realReturn}
        lumpSums={scenario.lumpSums}
        expenses={scenario.expenses}
      />

      <form class="form" onSubmit={(e) => e.preventDefault()}>
        <section class="section">
          <h2>About you</h2>
          <div class="subheading">You</div>
          <div class="field-grid">
            <NumberField label="Your age" value={state.primary.age} min={18} max={99}
              onChange={(n) => update({ primary: { ...state.primary, age: n } })} />
            <NumberField label="Your salary" value={state.primary.salary} step={1000} prefix="$"
              onChange={(n) => update({ primary: { ...state.primary, salary: n } })} />
            <NumberField label="Your retirement age" value={state.primary.retireAge} min={state.primary.age} max={80}
              onChange={(n) => update({ primary: { ...state.primary, retireAge: n } })} />
          </div>

          <div class="subheading">Household</div>
          <div class="field-grid">
            <NumberField label="Household 401(k)/IRA balance" value={state.accounts.pretax.balance} step={1000} prefix="$"
              hint="Combined with your spouse's, if you add one below. Traditional 401(k), 403(b), or IRA."
              info={ACCOUNT_INFO.pretax}
              onChange={(n) => updateAccount('pretax', { enabled: true, balance: n })} />
            <NumberField
              label="Household spending in retirement"
              value={state.spendingAnnual}
              step={1000}
              prefix="$"
              hint={state.spendingTouched ? 'Combined spending for the whole household' : 'Estimated from your income — edit if you know your number'}
              onChange={(n) => update({ spendingAnnual: n, spendingTouched: true })}
            />
          </div>

          <Checkbox
            label="I also want to enter what we spend now, before retiring"
            checked={state.preRetirementEnabled}
            onChange={(preRetirementEnabled) =>
              update({
                preRetirementEnabled,
                // Seed with today's income less contributions — the figure
                // the model already assumes implicitly — so turning this on
                // starts from the current answer rather than from zero.
                ...(preRetirementEnabled && state.preRetirementSpending === 0
                  ? { preRetirementSpending: suggestedPreRetirementSpending(state) }
                  : {}),
              })
            }
          />
          {state.preRetirementEnabled && (
            <div class="field-grid">
              <NumberField
                label="Household spending now"
                value={state.preRetirementSpending}
                step={1000}
                prefix="$"
                hint="Everything you spend in a year today, including any expenses listed below"
                info={PRE_RETIREMENT_INFO}
                onChange={(n) => update({ preRetirementSpending: n })}
              />
            </div>
          )}
        </section>

        <SectionToggle
          name="household"
          label="Household &amp; savings"
          summary="Spouse, contributions, and your other accounts"
          state={state}
          onToggle={toggleSection}
        />
        {state.open.household && (
          <section class="section">
            <div class="subheading">Spouse</div>
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

            <div class="subheading">Household accounts</div>
            <p class="subheading-note">
              Combined totals — yours and your spouse's added together, not separate per-person
              figures.
            </p>
            <div class="field-grid">
              <NumberField label="401(k)/IRA contribution" value={state.accounts.pretax.contribution} step={500} prefix="$"
                hint="Everyone's contributions plus any employer match, per year"
                onChange={(n) => updateAccount('pretax', { contribution: n })} />
              <NumberField label="Roth balance" value={state.accounts.roth.balance} step={1000} prefix="$"
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
              <NumberField label="HSA balance" value={state.accounts.hsa.balance} step={500} prefix="$"
                info={ACCOUNT_INFO.hsa}
                onChange={(n) => updateAccount('hsa', { enabled: true, balance: n })} />
            </div>
          </section>
        )}

        <SectionToggle
          name="income"
          label="Income in retirement"
          summary="Social Security, pensions, and any other regular income"
          state={state}
          onToggle={toggleSection}
        />
        {state.open.income && (
          <section class="section">
            <div class="subheading">Your Social Security</div>
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
            <div class="field-grid">
              {state.primary.ssMode === 'manual' && (
                <NumberField
                  label="Monthly benefit at full retirement age"
                  value={state.primary.ssMonthly}
                  step={50}
                  prefix="$"
                  onChange={(n) => update({ primary: { ...state.primary, ssMonthly: n } })}
                />
              )}
              {state.primary.ssMode !== 'none' && (
                <NumberField label="Claim age" value={state.primary.ssClaimAge} min={62} max={70}
                  hint="Claiming at 62 costs about 30% permanently; waiting to 70 adds about 24%"
                  onChange={(n) => update({ primary: { ...state.primary, ssClaimAge: n } })} />
              )}
            </div>
            {state.hasSpouse && (
              <p class="subheading-note">
                Your spouse's benefit is always estimated automatically from their salary — see
                the estimate below.
              </p>
            )}
            <SocialSecurityDetail people={scenario.people} />

            <div class="subheading">Pensions</div>
            <PensionFields
              label="Your pension"
              startAgeMin={state.primary.age}
              person={state.primary}
              onChange={(patch) => update({ primary: { ...state.primary, ...patch } })}
            />
            {state.hasSpouse && (
              <PensionFields
                label="Spouse's pension"
                startAgeMin={state.spouse.age}
                person={state.spouse}
                onChange={(patch) => update({ spouse: { ...state.spouse, ...patch } })}
              />
            )}

            <div class="subheading">Other regular income</div>
            <p class="subheading-note">
              Rental income, part-time work in retirement, an annuity, royalties — anything
              regular that isn't a salary or Social Security.
            </p>
            <IncomeFields items={state.incomes} onAdd={addIncome} onUpdate={updateIncome} onRemove={removeIncome} />
          </section>
        )}

        <SectionToggle
          name="expenses"
          label="Expenses &amp; one-time amounts"
          summary="Costs that don't run the whole plan, and money that lands once"
          state={state}
          onToggle={toggleSection}
        />
        {state.open.expenses && (
          <section class="section">
            <div class="subheading">Recurring for a while</div>
            <p class="subheading-note">
              Costs that run for several years but not the whole plan — a mortgage that pays off
              partway through, health insurance before Medicare, a few years of childcare.
            </p>
            <ExpenseFields items={state.expenses} onAdd={addExpense} onUpdate={updateExpense} onRemove={removeExpense} />

            <div class="subheading">One-time amounts</div>
            <p class="subheading-note">
              Money that lands in a single year, in either direction. Most are costs — a roof, a
              car, a wedding, an entry fee for a care community. Some are windfalls, like an
              inheritance or a home sale.
            </p>
            <LumpSumFields items={state.lumpSums} onAdd={addLumpSum} onUpdate={updateLumpSum} onRemove={removeLumpSum} />
          </section>
        )}

        <SectionToggle
          name="assumptions"
          label="Assumptions"
          summary="Return, taxes, and how long the plan runs"
          state={state}
          onToggle={toggleSection}
        />
        {state.open.assumptions && (
          <section class="section">
            <p class="subheading-note">
              Nobody knows these numbers. The defaults are reasonable; change them to see how much
              the answer depends on them.
            </p>
            <div class="field-grid">
              <NumberField label="Plan to age" value={state.primary.planToAge} min={state.primary.age + 1} max={105}
                hint="How long the money needs to last"
                onChange={(n) => update({ primary: { ...state.primary, planToAge: n } })} />
              <NumberField label="Assumed real return" value={Math.round(state.realReturn * 1000) / 10} step={0.1} suffix="%"
                hint="Above inflation, after fees"
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
