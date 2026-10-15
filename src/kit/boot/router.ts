/**
 * kit/boot: route once at boot, in the standard priority order.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md § "Routing"
 *
 * 1. a race start (the hub calls the race definition itself) and a queued
 *    launch (kit/online) win; a seat held after a reload is reclaimed (6 s);
 *    the lobby URL (`?mp=lobby`) waits 3 s for its launch, then hosts a room;
 * 2. a daily (`?daily=` or the menu) that is queued plays now; a `?daily=`
 *    still being answered keeps the loading screen (its 8 s fallback shows the title);
 * 3. `?hub_resume=1` with a saved game: straight back in, no prompt (hub.md "Resume");
 * 4. otherwise the title (its Continue row appears once the lookup answers).
 * The profile gets 2.5 s to load first (8 s when resuming; solitaire's numbers).
 */
import { withTimeout } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { JsonObject } from '../core/json.ts';
import type { DailyHandle } from '../daily/index.ts';
import type { ResumeSlot } from '../resume/index.ts';
import type { ProfileStore } from '../save/profile.ts';
import type { LaunchHandle } from '../online/launch.ts';
import type { OnlineFlow } from './online-flow.ts';
import type { Session } from './session.ts';

/** Route the first screen. */
export async function routeOnce<P extends JsonObject, R extends JsonObject>(o: {
  session: Session<P, R>;
  daily: DailyHandle | null;
  profile: ProfileStore<P>;
  resume: ResumeSlot<R>;
  clock: Clock;
  search: string;
  launches: LaunchHandle | null;
  online: OnlineFlow | null;
}): Promise<void> {
  const lookup = o.resume.load();
  await withTimeout(o.clock, o.profile.ready(), o.resume.requested ? 8000 : 2500, undefined);
  if (o.session.mode !== null) return; // a race already started
  if (o.launches?.ready() === true) return; // 1. a launch that waited for mount
  if (o.online !== null) {
    // A seat held after a reload (the hub also sends a rejoin launch; whichever comes first wins).
    const back = await withTimeout(o.clock, o.online.match.reclaim(), 6000, false);
    if (back) return;
    if (new URLSearchParams(o.search).get('mp') === 'lobby') {
      // The lobby URL: wait briefly for the launch that brought the player, else host a room.
      await withTimeout(o.clock, new Promise<never>(() => undefined), 3000, null);
      if (o.session.mode === null) await o.online.hostRoom();
      return;
    }
  }
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
