# Known gaps

Things this tool doesn't model yet, in rough priority order. Priority here
means "how much would this change the answer for how many people" — not
implementation difficulty. Each one is deliberate scope, not an oversight:
building it now would have cost accuracy elsewhere for less benefit, per the
friction-budget philosophy this project runs on (see `README.md`).

## 1. Required minimum distributions (RMDs)

Pre-tax accounts (401(k), traditional IRA) force taxable withdrawals
starting at age 73, regardless of whether the household needs the money.
`EffectiveRateTax` doesn't model this — a large pre-tax balance can sit
untouched past 73 in the current ledger, which understates both the tax
bill and the withdrawal itself for anyone who saved heavily into pre-tax
accounts and doesn't spend it all. Already flagged inline at
`src/engine/taxes.ts:55`, and the `rmd-heavy-73` persona exists specifically
to catch this once it's fixed — right now it's a documented, accepted gap,
not a passing test.

Where it plugs in: the ledger's per-year loop in `src/engine/ledger.ts`,
as a forced minimum withdrawal from `pretax` computed before the
discretionary withdrawal logic runs.

## 2. Bracket-based and state income tax

`EffectiveRateTax` is a single flat rate applied to all ordinary income —
no standard deduction, no progressive brackets, no state tax, no
distinction between ordinary income and long-term capital gains rates. It's
the single biggest source of near-term-forecast error in the tool, and the
one most likely to matter for anyone near a bracket edge or a low-tax
state.

Where it plugs in: `TaxModel` in `src/engine/taxes.ts` is already an
interface for exactly this reason — a `BracketTax` implementation drops in
without the ledger changing. State tax would need a per-state bracket table
(a real, ongoing maintenance cost, which is why it wasn't first).

## 3. Dynamic/guardrail withdrawal strategies

`SpendingPath` supports only `flat` (constant real spending) and
`retirement-smile` (a fixed decline-then-uptick curve). Neither responds to
how the portfolio is actually doing — a household willing to spend less
after a bad market year, or more after a good one, can sustain meaningfully
higher spending than a fixed-withdrawal plan, and that's a common real
strategy this tool currently can't represent at all.

Where it plugs in: `src/engine/spending.ts` — would need the ledger's
per-year loop to consult portfolio state (not just the calendar) when
computing `spendingNeed`, which is a bigger structural change than the
other items here since spending currently doesn't feed back from the
portfolio.

## 4. Social Security claiming-age comparison

The tool models one claim age at a time and shows its estimated benefit —
correctly, but as a single number rather than a comparison. Claim age is
one of the largest single levers a person controls (see
`src/engine/socialsecurity.ts`), and seeing the age-62-through-70 tradeoff
side by side, rather than changing one field and rerunning, would make that
lever much easier to actually use.

Where it plugs in: purely a UI feature — `estimatedBenefit()` already
computes the full curve if called at each age; needs a small chart or table
in `SocialSecurityDetail` (`src/ui/App.tsx`).

## 5. Roth conversion planning

No support for modeling a deliberate conversion from a pre-tax account to
Roth in a specific year (or years) to fill a low tax bracket while income
is temporarily low — a common strategy in the years between retiring and
claiming Social Security/RMDs. Depends on item #2 (bracket tax) to be
worth building — without real brackets, there's no bracket to fill.

## 6. User-configurable withdrawal order

`assumptions.withdrawalOrder` exists in the engine and defaults to taxable
→ pretax → roth → hsa (the conventional default), but there's no UI control
for it. Someone with a specific tax-sequencing strategy in mind can't
express it.

Where it plugs in: a small reorderable list or preset picker in the
Advanced section of `src/ui/App.tsx`; the engine already reads whatever
order it's given.

## 7. Survivor Social Security benefits

When a spouse dies, the survivor is generally entitled to the higher of
the two Social Security benefits, not both combined — the ledger currently
just keeps paying both benefits independently until each person's own
`planToAge`. Already noted as a `knownGap` on the `spousal-age-gap-64` and
`widowed-60` personas in `tests/personas/preretirement.ts`.

## 8. One pension per person, one account per kind

The engine's `Pension[]` and `Account[]` both support any number of
entries, but the UI caps pensions at one per person (documented on
`fromPerson` in `src/ui/state.ts`) and pools every account of a given kind
into a single combined balance — you can't track a specific old 401(k)
separately from a current one. Both are deliberate friction-reduction
choices, not oversights, but they're real expressiveness limits for the
minority of households with genuinely multiple accounts of the same kind or
multiple pensions each.
