/**
 * daily-puzzle kit: the pinned generator version, with a date cutoff.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * A change to the engine or the generator can change the puzzle a seed gives,
 * including past days a player can still back-fill (the hub's 30-day window).
 * So a game keeps each generator it has shipped, tagged with the first day it
 * builds: a day before a version's cutoff keeps using the older one, and
 * back-filled days rebuild exactly. Give a new version a `from` day after it
 * deploys, and drop an old one only once its last day has left the window.
 * Guard the versions with a snapshot test of puzzle hashes for fixed days.
 */
import { isDayKey } from './days.ts';

/** One shipped generator: `build` makes the puzzles of `from` onwards. */
export type GenVersion<B> = {
  /** Sent in `complete({ gen })`, so a reported line can be replayed with the right generator. */
  version: number;
  /** The first day this version builds (`YYYY-MM-DD`), or `null` for the first version. */
  from: string | null;
  build: B;
};

/** Check a version list: increasing versions, increasing cutoffs, only the first without one. */
export function checkVersions<B>(versions: readonly GenVersion<B>[]): void {
  if (versions.length === 0) throw new RangeError('versions: none');
  versions.forEach((v, i) => {
    if (i === 0) {
      if (v.from !== null && !isDayKey(v.from)) throw new RangeError(`versions: bad day ${v.from}`);
      return;
    }
    const prev = versions[i - 1];
    if (v.version <= prev.version) throw new RangeError(`versions: ${v.version} after ${prev.version}`);
    if (v.from === null || !isDayKey(v.from)) throw new RangeError(`versions: version ${v.version} needs a from day`);
    if (prev.from !== null && v.from <= prev.from) throw new RangeError(`versions: ${v.from} is not after ${prev.from}`);
  });
}

/** The version that builds `day`: the newest whose `from` is on or before it. */
export function versionFor<B>(versions: readonly GenVersion<B>[], day: string): GenVersion<B> {
  checkVersions(versions);
  if (!isDayKey(day)) throw new RangeError(`not a day key: ${day}`);
  let pinned = versions[0];
  for (const v of versions) if (v.from === null || v.from <= day) pinned = v;
  return pinned;
}

/** A shipped version by number (to replay a reported line with the generator it came from). */
export function versionNumbered<B>(versions: readonly GenVersion<B>[], version: number): GenVersion<B> | null {
  return versions.find((v) => v.version === version) ?? null;
}
