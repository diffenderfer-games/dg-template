/**
 * kit/boot: route once at boot, in the standard priority order.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md § "Routing"
 *
 * 1. a queued launch (kit/online) and 2. a race start (the hub calls the race
 *    definition itself) win: they already started a session;
 * 3. a daily (`?daily=` or the menu) that is queued plays now; a `?daily=`
 *    still being answered keeps the loading screen (its 8 s fallback shows the title);
 * 4. `?hub_resume=1` with a saved game: straight back in, no prompt (hub.md "Resume");
 * 5. otherwise the title (its Continue row appears once the lookup answers).
 * The profile gets 2.5 s to load first (8 s when resuming; solitaire's numbers).
 */
import { withTimeout } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { JsonObject } from '../core/json.ts';
import type { DailyHandle } from '../daily/index.ts';
import type { ResumeSlot } from '../resume/index.ts';
import type { ProfileStore } from '../save/profile.ts';
import type { Session } from './session.ts';

/** Route the first screen. */
export async function routeOnce<P extends JsonObject, R extends JsonObject>(o: {
  session: Session<P, R>;
  daily: DailyHandle | null;
  profile: ProfileStore<P>;
  resume: ResumeSlot<R>;
  clock: Clock;
  search: string;
}): Promise<void> {
  const lookup = o.resume.load();
  await withTimeout(o.clock, o.profile.ready(), o.resume.requested ? 8000 : 2500, undefined);
  if (o.session.mode !== null) return; // a launch or a race already started
  o.daily?.ready();
  if (o.session.mode !== null) return; // a queued daily started
  if (o.daily !== null && new URLSearchParams(o.search).has('daily')) return; // still being answered
  if (o.resume.requested) {
    const saved = await withTimeout(o.clock, lookup, 8000, null);
    if (saved !== null && o.session.mode === null) {
      await o.session.continueSaved();
      return;
    }
  }
  if (o.session.mode !== null) return;
  await o.session.showTitle();
  void lookup.then(() => {
    if (o.session.screen === 'title') void o.session.showTitle();
  });
}
