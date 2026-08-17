import { describe, expect, it } from 'vitest'
import { blankExpense, blankIncome, blankLumpSum, exampleState, fromScenario, toScenario } from '../src/ui/state'
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

  describe('pre-retirement spending', () => {
    it('is off by default, leaving working years contribution-driven', () => {
      expect(toScenario(exampleState()).spending.preRetirement).toBeUndefined()
    })

    it('is omitted when enabled but left at zero, rather than budgeting $0/yr', () => {
      const state = exampleState()
      state.preRetirementEnabled = true
      state.preRetirementSpending = 0
      expect(toScenario(state).spending.preRetirement).toBeUndefined()
    })

    it('is carried through once entered', () => {
      const state = exampleState()
      state.preRetirementEnabled = true
      state.preRetirementSpending = 72_000
      expect(toScenario(state).spending.preRetirement).toBe(72_000)
    })

    it('round-trips through the URL codec', () => {
      const state = exampleState()
      state.preRetirementEnabled = true
      state.preRetirementSpending = 72_000

      const scenario = toScenario(state)
      expect(decode(encode(scenario)).spending).toEqual(scenario.spending)
    })

    it('stays absent from a URL when unset, so old links keep their meaning', () => {
      const scenario = toScenario(exampleState())
      expect(encode(scenario)).not.toContain('spp')
      expect(decode(encode(scenario)).spending.preRetirement).toBeUndefined()
    })

    it('round-trips the enabled flag back through fromScenario', () => {
      const state = exampleState()
      state.preRetirementEnabled = true
      state.preRetirementSpending = 72_000

      const rebuilt = fromScenario(toScenario(state))
      expect(rebuilt.preRetirementEnabled).toBe(true)
      expect(rebuilt.preRetirementSpending).toBe(72_000)
    })
  })

  describe('irregular incomes, expenses, and one-time amounts', () => {
    // These three were the actual bug this test block exists to guard
    // against: toScenario() silently hardcoded all three to [], so nothing
    // typed into a (nonexistent) form for them could ever reach the engine
    // or the URL. There was no field at all, for any of the three, until now.

    it('starts with none of the three in the example state', () => {
      const scenario = toScenario(exampleState())
      expect(scenario.incomes).toEqual([])
      expect(scenario.expenses).toEqual([])
      expect(scenario.lumpSums).toEqual([])
    })

    it('drops a blank draft row (no label, no amount) from all three', () => {
      const state = exampleState()
      state.incomes = [blankIncome(67)]
      state.expenses = [blankExpense(67)]
      state.lumpSums = [blankLumpSum(67)]

      const scenario = toScenario(state)
      expect(scenario.incomes).toEqual([])
      expect(scenario.expenses).toEqual([])
      expect(scenario.lumpSums).toEqual([])
    })

    it('includes a fully-specified income stream, with an end age omitted unless set', () => {
      const state = exampleState()
      const income = blankIncome(65)
      income.label = 'Rental income'
      income.annual = 18_000
      income.taxable = true
      state.incomes = [income]

      let scenario = toScenario(state)
      expect(scenario.incomes).toEqual([
        { label: 'Rental income', annual: 18_000, startAge: 65, inflationAdjusted: true, taxable: true },
      ])

      income.hasEndAge = true
      income.endAge = 80
      scenario = toScenario(state)
      expect(scenario.incomes[0]!.endAge).toBe(80)
    })

    it('includes a fully-specified expense', () => {
      const state = exampleState()
      const expense = blankExpense(65)
      expense.label = 'Health insurance premiums'
      expense.annual = 14_000
      expense.hasEndAge = true
      expense.endAge = 65
      state.expenses = [expense]

      expect(toScenario(state).expenses).toEqual([
        {
          label: 'Health insurance premiums',
          annual: 14_000,
          startAge: 65,
          endAge: 65,
          inflationAdjusted: true,
        },
      ])
    })

    it('includes a fully-specified inflow, landing in the chosen account', () => {
      const state = exampleState()
      const lump = blankLumpSum(70)
      lump.label = 'Inheritance'
      lump.direction = 'inflow'
      lump.amount = 250_000
      lump.into = 'roth'
      state.lumpSums = [lump]

      expect(toScenario(state).lumpSums).toEqual([
        { label: 'Inheritance', amount: 250_000, atAge: 70, into: 'roth', taxable: false },
      ])
    })

    it('defaults a new one-time amount to a cost, the far more common case', () => {
      // Across the persona library one-time costs outnumber windfalls about
      // five to one, so the form should not make the common case the one you
      // have to go change.
      expect(blankLumpSum(70).direction).toBe('cost')
    })

    it('negates a cost, so the user never types a minus sign', () => {
      const state = exampleState()
      const lump = blankLumpSum(74)
      lump.label = 'New roof'
      lump.amount = 22_000 // entered positive
      state.lumpSums = [lump]

      expect(toScenario(state).lumpSums[0]!.amount).toBe(-22_000)
    })

    it('ignores a stray minus sign rather than flipping a cost into a windfall', () => {
      const state = exampleState()
      const lump = blankLumpSum(74)
      lump.label = 'New roof'
      lump.amount = -22_000
      state.lumpSums = [lump]

      expect(toScenario(state).lumpSums[0]!.amount).toBe(-22_000)
    })

    it('never marks a cost as taxable income', () => {
      // A cost is not a deduction; sending taxable:true would be misleading
      // even though the engine ignores the flag for negative amounts.
      const state = exampleState()
      const lump = blankLumpSum(74)
      lump.label = 'Care community entry fee'
      lump.amount = 60_000
      lump.taxable = true
      state.lumpSums = [lump]

      expect(toScenario(state).lumpSums[0]!.taxable).toBe(false)
    })

    it('round-trips direction through fromScenario, recovering it from the sign', () => {
      const state = exampleState()
      const cost = blankLumpSum(74)
      cost.label = 'New roof'
      cost.amount = 22_000
      const windfall = blankLumpSum(62)
      windfall.label = 'Inheritance'
      windfall.direction = 'inflow'
      windfall.amount = 65_000
      state.lumpSums = [cost, windfall]

      const rebuilt = fromScenario(toScenario(state))
      expect(rebuilt.lumpSums.map((l) => [l.direction, l.amount])).toEqual([
        ['cost', 22_000],
        ['inflow', 65_000],
      ])
    })

    it('supports multiple independent items of each kind', () => {
      const state = exampleState()
      state.incomes = [blankIncome(65), blankIncome(70)]
      state.incomes[0]!.label = 'Part-time work'
      state.incomes[0]!.annual = 12_000
      state.incomes[1]!.label = 'Annuity'
      state.incomes[1]!.annual = 9_000

      const scenario = toScenario(state)
      expect(scenario.incomes).toHaveLength(2)
      expect(scenario.incomes.map((i) => i.label)).toEqual(['Part-time work', 'Annuity'])
    })

    it('round-trips all three through fromScenario(toScenario(s))', () => {
      const state = exampleState()

      const income = blankIncome(65)
      income.label = 'Rental income'
      income.annual = 18_000
      income.hasEndAge = true
      income.endAge = 85
      state.incomes = [income]

      const expense = blankExpense(60)
      expense.label = 'Mortgage'
      expense.annual = 24_000
      expense.hasEndAge = true
      expense.endAge = 72
      expense.inflationAdjusted = false
      state.expenses = [expense]

      const lump = blankLumpSum(68)
      lump.label = 'Home sale'
      lump.amount = 400_000
      lump.into = 'taxable'
      lump.taxable = false
      state.lumpSums = [lump]

      const original = toScenario(state)
      const rebuilt = toScenario(fromScenario(original))
      expect(rebuilt).toEqual(original)
    })

    it('round-trips all three through the URL codec', () => {
      const state = exampleState()
      state.incomes = [blankIncome(65)]
      state.incomes[0]!.label = 'Royalties'
      state.incomes[0]!.annual = 5_000
      state.expenses = [blankExpense(70)]
      state.expenses[0]!.label = 'Long-term care'
      state.expenses[0]!.annual = 60_000
      state.lumpSums = [blankLumpSum(75)]
      state.lumpSums[0]!.label = 'Business sale'
      state.lumpSums[0]!.amount = 600_000

      const scenario = toScenario(state)
      const decoded = decode(encode(scenario))
      expect(decoded.incomes).toEqual(scenario.incomes)
      expect(decoded.expenses).toEqual(scenario.expenses)
      expect(decoded.lumpSums).toEqual(scenario.lumpSums)
    })
  })
})
