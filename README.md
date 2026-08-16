# Retirement Readiness

The fastest way to find out whether you can retire.

A single-page calculator with **no backend, no account, and no storage** — the entire plan is encoded in the URL, so a link is the save file. Copy it, bookmark it, send it to your spouse.

**Live:** https://gordl.github.io/retirement-calculator/

## Why another retirement calculator

The thorough ones make you fill in forty fields before showing you anything. The instant ones answer with a number too crude to trust.

This one treats **input burden as the thing to optimize**. Every question the tool could ask is scored by how much it actually moves the answer across a representative sample of US households — and the ones that don't move it get a sensible default instead of a field. Speed here is not about rendering; it's about not asking.

That claim is measured, not asserted. See below.

## The test suite is a usability benchmark

The primary test suite is a library of ~50 artificial households stratified to represent the US population — weighted by real distributions, not by who typically uses retirement software. For every one of them the suite asks:

1. **Expressibility** — can the model represent this household at all? Anything it can't is logged as a weighted coverage gap.
2. **Friction** — how many fields must this person fill before the answer stops moving? Budgets are asserted in CI:
   - p50 ≤ 6 fields
   - p90 ≤ 12 fields
   - no household above 20
3. **Default sensitivity** — how much does each field change the answer versus leaving it defaulted? This produces an information-value ranking of every possible question, and **the UI's input order is derived from that ranking** rather than from intuition.

Numerical correctness tests (accounting invariants, closed-form annuity checks, seeded-Monte-Carlo determinism) exist underneath as a floor, so the friction metric is measuring something trustworthy.

A regression in the friction budget fails the build. The tool cannot quietly get slower to use.

## Modeling

One year-by-year ledger, with pluggable models layered on top:

- **Returns** — fixed real return (headline number), lognormal Monte Carlo with a seeded PRNG (probability of success), and historical rolling cohorts 1928–2025 (real sequence-of-returns risk, including the 1966 retiree).
- **Taxes** — an effective-rate approximation in v1, behind an interface that a full bracket model drops into later.
- **Social Security** — estimated from salary and work history via the AIME/bend-point formula, so you don't have to go look your benefit up. Override it if you know the real number.

Not modeled yet: state tax, IRMAA, Roth conversions, long-term care, annuity products. Each is additive behind an existing interface.

## Development

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run type-check
```

Pushing to `main` type-checks, tests, builds, and deploys to GitHub Pages.

## Disclaimer

This is a modeling tool, not financial advice. Projections are estimates built on assumptions that will not match your future. Talk to a licensed advisor before making decisions about your retirement.

## License

MIT
