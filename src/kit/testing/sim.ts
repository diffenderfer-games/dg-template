/**
 * kit/testing: a headless balance sim. Play the rules many times with a policy, summarize the numbers.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Sim"
 *
 * The rules are pure (no DOM, no hub, seeded RNG), so a game can be played a
 * thousand times in a second. Use it to check tuning ("an average player wins
 * a daily in 30–90 s") in a unit test and from `npm run sim`.
 */

/** One way to play the rules. */
export type SimSpec<S, I> = {
  /** A fresh game from a seed. */
  start(seed: number): S;
  /** What the player does this step. */
  policy(state: S, step: number): I;
  /** Advance by `dt` seconds. */
  step(state: S, dt: number, input: I): void;
  /** Over? (the outcome, or null while playing) */
  outcome(state: S): string | null;
  /** Numbers to summarize per game (score, seconds, moves…). */
  measure(state: S, steps: number): Record<string, number>;
  /** Seconds per step (default 1/60). */
  dt?: number;
  /** Give up after this many steps (default 60 × 60 × 10 = ten minutes). */
  maxSteps?: number;
};

/** Min, max, mean and median of one measure. */
export type SimStat = { min: number; max: number; mean: number; median: number };

/** What `simulate` reports. */
export type SimReport = {
  games: number;
  /** How many games ended each way (`timeout` when `maxSteps` ran out). */
  outcomes: Record<string, number>;
  stats: Record<string, SimStat>;
};

function summarize(values: number[]): SimStat {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length),
    median,
  };
}

/** Play `seeds.length` games (one per seed) and summarize. */
export function simulate<S, I>(spec: SimSpec<S, I>, seeds: readonly number[]): SimReport {
  const dt = spec.dt ?? 1 / 60;
  const maxSteps = spec.maxSteps ?? 36_000;
  const outcomes: Record<string, number> = {};
  const columns: Record<string, number[]> = {};
  for (const seed of seeds) {
    const state = spec.start(seed);
    let steps = 0;
    let end = spec.outcome(state);
    while (end === null && steps < maxSteps) {
      spec.step(state, dt, spec.policy(state, steps));
      steps++;
      end = spec.outcome(state);
    }
    const key = end ?? 'timeout';
    outcomes[key] = (outcomes[key] ?? 0) + 1;
    for (const [k, v] of Object.entries(spec.measure(state, steps))) (columns[k] ??= []).push(v);
  }
  const stats: Record<string, SimStat> = {};
  for (const [k, v] of Object.entries(columns)) stats[k] = summarize(v);
  return { games: seeds.length, outcomes, stats };
}

/** `count` seeds from `from` (1, 2, 3…), for reproducible sims. */
export const seedRange = (count: number, from = 1): number[] => Array.from({ length: count }, (_, i) => from + i);

/** A one-screen text table of a report. */
export function formatReport(r: SimReport): string {
  const lines = [
    `${r.games} games: ${Object.entries(r.outcomes)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  ];
  for (const [k, s] of Object.entries(r.stats)) {
    lines.push(
      `  ${k.padEnd(12)} min ${s.min.toFixed(1)}  median ${s.median.toFixed(1)}  mean ${s.mean.toFixed(1)}  max ${s.max.toFixed(1)}`,
    );
  }
  return lines.join('\n');
}
