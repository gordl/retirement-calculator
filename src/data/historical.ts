/**
 * Annual US market returns, 1928–2025.
 *
 * Nominal S&P 500 total return (with dividends) and 10-year Treasury bond
 * return: NYU Stern (Damodaran), Historical Returns on Stocks, Bonds and
 * Bills, https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html
 *
 * Annual CPI-U inflation: officialdata.org US inflation calculator,
 * https://www.officialdata.org/us/inflation/1928
 *
 * This is the only place in the project holding real market history, and it
 * exists for one purpose: `HistoricalCohorts` walks every 1928–2025 window so
 * a plan can be stress-tested against sequences that actually happened —
 * 1929, 1937, 1966, 1973, 2000, 2008 — rather than only against a smooth
 * average. A portfolio that survives every historical rolling window is a
 * portfolio that has survived the worst decades the last century produced.
 */

export interface HistoricalYear {
  year: number
  /** Nominal S&P 500 total return, percent. */
  spNominal: number
  /** Nominal 10-year Treasury bond return, percent. */
  bondNominal: number
  /** CPI-U annual inflation, percent. */
  cpi: number
}

export const HISTORICAL_YEARS: HistoricalYear[] = [
  { year: 1928, spNominal: 43.81, bondNominal: 0.84, cpi: -1.72 },
  { year: 1929, spNominal: -8.30, bondNominal: 4.20, cpi: 0.00 },
  { year: 1930, spNominal: -25.12, bondNominal: 4.54, cpi: -2.34 },
  { year: 1931, spNominal: -43.84, bondNominal: -2.56, cpi: -8.98 },
  { year: 1932, spNominal: -8.64, bondNominal: 8.79, cpi: -9.87 },
  { year: 1933, spNominal: 49.98, bondNominal: 1.86, cpi: -5.11 },
  { year: 1934, spNominal: -1.19, bondNominal: 7.96, cpi: 3.08 },
  { year: 1935, spNominal: 46.74, bondNominal: 4.47, cpi: 2.24 },
  { year: 1936, spNominal: 31.94, bondNominal: 5.02, cpi: 1.46 },
  { year: 1937, spNominal: -35.34, bondNominal: 1.38, cpi: 3.60 },
  { year: 1938, spNominal: 29.28, bondNominal: 4.21, cpi: -2.08 },
  { year: 1939, spNominal: -1.10, bondNominal: 4.41, cpi: -1.42 },
  { year: 1940, spNominal: -10.67, bondNominal: 5.40, cpi: 0.72 },
  { year: 1941, spNominal: -12.77, bondNominal: -2.02, cpi: 5.00 },
  { year: 1942, spNominal: 19.17, bondNominal: 2.29, cpi: 10.88 },
  { year: 1943, spNominal: 25.06, bondNominal: 2.49, cpi: 6.13 },
  { year: 1944, spNominal: 19.03, bondNominal: 2.58, cpi: 1.73 },
  { year: 1945, spNominal: 35.82, bondNominal: 3.80, cpi: 2.27 },
  { year: 1946, spNominal: -8.43, bondNominal: 3.13, cpi: 8.33 },
  { year: 1947, spNominal: 5.20, bondNominal: 0.92, cpi: 14.36 },
  { year: 1948, spNominal: 5.70, bondNominal: 1.95, cpi: 8.07 },
  { year: 1949, spNominal: 18.30, bondNominal: 4.66, cpi: -1.24 },
  { year: 1950, spNominal: 30.81, bondNominal: 0.43, cpi: 1.26 },
  { year: 1951, spNominal: 23.68, bondNominal: -0.30, cpi: 7.88 },
  { year: 1952, spNominal: 18.15, bondNominal: 2.27, cpi: 1.92 },
  { year: 1953, spNominal: -1.21, bondNominal: 4.14, cpi: 0.75 },
  { year: 1954, spNominal: 52.56, bondNominal: 3.29, cpi: 0.75 },
  { year: 1955, spNominal: 32.60, bondNominal: -1.34, cpi: -0.37 },
  { year: 1956, spNominal: 7.44, bondNominal: -2.26, cpi: 1.49 },
  { year: 1957, spNominal: -10.46, bondNominal: 6.80, cpi: 3.31 },
  { year: 1958, spNominal: 43.72, bondNominal: -2.10, cpi: 2.85 },
  { year: 1959, spNominal: 12.06, bondNominal: -2.65, cpi: 0.69 },
  { year: 1960, spNominal: 0.34, bondNominal: 11.64, cpi: 1.72 },
  { year: 1961, spNominal: 26.64, bondNominal: 2.06, cpi: 1.01 },
  { year: 1962, spNominal: -8.81, bondNominal: 5.69, cpi: 1.00 },
  { year: 1963, spNominal: 22.61, bondNominal: 1.68, cpi: 1.32 },
  { year: 1964, spNominal: 16.42, bondNominal: 3.73, cpi: 1.31 },
  { year: 1965, spNominal: 12.40, bondNominal: 0.72, cpi: 1.61 },
  { year: 1966, spNominal: -9.97, bondNominal: 2.91, cpi: 2.86 },
  { year: 1967, spNominal: 23.80, bondNominal: -1.58, cpi: 3.09 },
  { year: 1968, spNominal: 10.81, bondNominal: 3.27, cpi: 4.19 },
  { year: 1969, spNominal: -8.24, bondNominal: -5.01, cpi: 5.46 },
  { year: 1970, spNominal: 3.56, bondNominal: 16.75, cpi: 5.72 },
  { year: 1971, spNominal: 14.22, bondNominal: 9.79, cpi: 4.38 },
  { year: 1972, spNominal: 18.76, bondNominal: 2.82, cpi: 3.21 },
  { year: 1973, spNominal: -14.31, bondNominal: 3.66, cpi: 6.22 },
  { year: 1974, spNominal: -25.90, bondNominal: 1.99, cpi: 11.04 },
  { year: 1975, spNominal: 37.00, bondNominal: 3.61, cpi: 9.13 },
  { year: 1976, spNominal: 23.83, bondNominal: 15.98, cpi: 5.76 },
  { year: 1977, spNominal: -6.98, bondNominal: 1.29, cpi: 6.50 },
  { year: 1978, spNominal: 6.51, bondNominal: -0.78, cpi: 7.59 },
  { year: 1979, spNominal: 18.52, bondNominal: 0.67, cpi: 11.35 },
  { year: 1980, spNominal: 31.74, bondNominal: -2.99, cpi: 13.50 },
  { year: 1981, spNominal: -4.70, bondNominal: 8.20, cpi: 10.32 },
  { year: 1982, spNominal: 20.42, bondNominal: 32.81, cpi: 6.16 },
  { year: 1983, spNominal: 22.34, bondNominal: 3.20, cpi: 3.21 },
  { year: 1984, spNominal: 6.15, bondNominal: 13.73, cpi: 4.32 },
  { year: 1985, spNominal: 31.24, bondNominal: 25.71, cpi: 3.56 },
  { year: 1986, spNominal: 18.49, bondNominal: 24.28, cpi: 1.86 },
  { year: 1987, spNominal: 5.81, bondNominal: -4.96, cpi: 3.65 },
  { year: 1988, spNominal: 16.54, bondNominal: 8.22, cpi: 4.14 },
  { year: 1989, spNominal: 31.48, bondNominal: 17.69, cpi: 4.82 },
  { year: 1990, spNominal: -3.06, bondNominal: 6.24, cpi: 5.40 },
  { year: 1991, spNominal: 30.23, bondNominal: 15.00, cpi: 4.21 },
  { year: 1992, spNominal: 7.49, bondNominal: 9.36, cpi: 3.01 },
  { year: 1993, spNominal: 9.97, bondNominal: 14.21, cpi: 2.99 },
  { year: 1994, spNominal: 1.33, bondNominal: -8.04, cpi: 2.56 },
  { year: 1995, spNominal: 37.20, bondNominal: 23.48, cpi: 2.83 },
  { year: 1996, spNominal: 22.68, bondNominal: 1.43, cpi: 2.95 },
  { year: 1997, spNominal: 33.10, bondNominal: 9.94, cpi: 2.29 },
  { year: 1998, spNominal: 28.34, bondNominal: 14.92, cpi: 1.56 },
  { year: 1999, spNominal: 20.89, bondNominal: -8.25, cpi: 2.21 },
  { year: 2000, spNominal: -9.03, bondNominal: 16.66, cpi: 3.36 },
  { year: 2001, spNominal: -11.85, bondNominal: 5.57, cpi: 2.85 },
  { year: 2002, spNominal: -21.97, bondNominal: 15.12, cpi: 1.58 },
  { year: 2003, spNominal: 28.36, bondNominal: 0.38, cpi: 2.28 },
  { year: 2004, spNominal: 10.74, bondNominal: 4.49, cpi: 2.66 },
  { year: 2005, spNominal: 4.83, bondNominal: 2.87, cpi: 3.39 },
  { year: 2006, spNominal: 15.61, bondNominal: 1.96, cpi: 3.23 },
  { year: 2007, spNominal: 5.48, bondNominal: 10.21, cpi: 2.85 },
  { year: 2008, spNominal: -36.55, bondNominal: 20.10, cpi: 3.84 },
  { year: 2009, spNominal: 25.94, bondNominal: -11.12, cpi: -0.36 },
  { year: 2010, spNominal: 14.82, bondNominal: 8.46, cpi: 1.64 },
  { year: 2011, spNominal: 2.10, bondNominal: 16.04, cpi: 3.16 },
  { year: 2012, spNominal: 15.89, bondNominal: 2.97, cpi: 2.07 },
  { year: 2013, spNominal: 32.15, bondNominal: -9.10, cpi: 1.46 },
  { year: 2014, spNominal: 13.52, bondNominal: 10.75, cpi: 1.62 },
  { year: 2015, spNominal: 1.38, bondNominal: 1.28, cpi: 0.12 },
  { year: 2016, spNominal: 11.77, bondNominal: 0.69, cpi: 1.26 },
  { year: 2017, spNominal: 21.61, bondNominal: 2.80, cpi: 2.13 },
  { year: 2018, spNominal: -4.23, bondNominal: -0.02, cpi: 2.49 },
  { year: 2019, spNominal: 31.21, bondNominal: 9.64, cpi: 1.76 },
  { year: 2020, spNominal: 18.02, bondNominal: 11.33, cpi: 1.23 },
  { year: 2021, spNominal: 28.47, bondNominal: -4.42, cpi: 4.70 },
  { year: 2022, spNominal: -18.04, bondNominal: -17.83, cpi: 8.00 },
  { year: 2023, spNominal: 26.06, bondNominal: 3.88, cpi: 4.12 },
  { year: 2024, spNominal: 24.88, bondNominal: -1.64, cpi: 2.89 },
  { year: 2025, spNominal: 17.78, bondNominal: 7.80, cpi: 2.76 },
]

/** Converts a nominal percent return and an inflation percent to a real decimal return. */
export function toReal(nominalPct: number, inflationPct: number): number {
  return (1 + nominalPct / 100) / (1 + inflationPct / 100) - 1
}

/**
 * A stock/bond-blended real return for one historical year, at the given
 * equity allocation. Blended at the return level (not simulated as two
 * separately-held accounts), which is the standard simplification for a
 * single-portfolio model and is consistent with how `assumptions.realReturn`
 * is used everywhere else in the engine.
 */
export function blendedRealReturn(y: HistoricalYear, stockAllocation: number): number {
  const stock = toReal(y.spNominal, y.cpi)
  const bond = toReal(y.bondNominal, y.cpi)
  return stockAllocation * stock + (1 - stockAllocation) * bond
}

/**
 * Empirical mean/stdev of real returns over the full 1928–2025 series, at a
 * given equity allocation. This is what calibrates `LognormalMC` — rather than
 * asserting a return distribution, the Monte Carlo model is parameterized from
 * the same history `HistoricalCohorts` walks directly, so the two stochastic
 * models agree on what "normal" looks like.
 */
export function empiricalMoments(stockAllocation: number): { mean: number; stdev: number } {
  const series = HISTORICAL_YEARS.map((y) => blendedRealReturn(y, stockAllocation))
  const mean = series.reduce((s, x) => s + x, 0) / series.length
  const variance =
    series.reduce((s, x) => s + (x - mean) ** 2, 0) / (series.length - 1)
  return { mean, stdev: Math.sqrt(variance) }
}
