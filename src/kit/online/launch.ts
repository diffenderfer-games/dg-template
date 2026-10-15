/**
 * kit/online: the launch adapter (the hub brings a player into the game).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Launches"
 *
 * Rules (multiplayer.md §6):
 * - `onLaunch` and `onJoinInfo` are registered at boot, synchronously, before
 *   any await (the hub's 8 second rule); launches before the game mounted wait;
 * - idempotent: a second identical launch (same kind and party or room) while
 *   it is still being handled, or while already in that room, is ignored;
 * - `host` creates the room for the party; `guest` joins the join info now or
 *   when it arrives; `join` / `watch` (also `via: 'link' | 'rejoin'`) join `launch.room`;
 * - race launches belong to the hub (it joins the race itself): ignored here;
 * - `launch.table` (world W2) and `launch.tournament` are passed through.
 */
import type { HubLike } from '../core/hub-like.ts';
import type { KitLaunch } from '../core/planned.ts';

/** Where each kind of launch goes (the session implements it). */
export type LaunchRoutes = {
  host(l: KitLaunch): Promise<void>;
  join(room: string, l: KitLaunch, spectate: boolean): Promise<void>;
  /** The code of the room the player is in now (null when none). */
  currentRoom(): string | null;
};

/** The adapter. */
export type LaunchHandle = {
  /** The game mounted: handle the launch that waited, if any. True when one was handled. */
  ready(): boolean;
  readonly pending: boolean;
};

/** A launch's identity (for the idempotency guard). */
const keyOf = (l: KitLaunch): string => `${l.kind}:${l.partyId ?? ''}:${l.room ?? ''}`;

/** Register the launch handlers now; route when ready. */
export function installLaunches(hub: Pick<HubLike, 'mp'>, routes: LaunchRoutes): LaunchHandle {
  let mounted = false;
  let queued: KitLaunch | null = null;
  let handling: string | null = null;
  let waitingParty: { partyId: string; launch: KitLaunch } | null = null;

  const route = async (l: KitLaunch): Promise<void> => {
    if (l.mode === 'race') return; // the hub joins the race itself
    const key = keyOf(l);
    if (handling === key) return;
    if (l.room !== undefined && routes.currentRoom() === l.room) return;
    handling = key;
    try {
      if (l.kind === 'host') await routes.host(l);
      else if (l.kind === 'guest') {
        const room = l.joinInfo?.room;
        if (room !== undefined) await routes.join(room, l, false);
        else if (l.partyId !== undefined) waitingParty = { partyId: l.partyId, launch: l };
      } else if (l.room !== undefined) await routes.join(l.room, l, l.kind === 'watch');
    } finally {
      handling = null;
    }
  };

  hub.mp.onLaunch((launch) => {
    if (!mounted) {
      queued = launch;
      return;
    }
    void route(launch);
  });
  hub.mp.onJoinInfo(({ partyId, info }) => {
    const room = info.room;
    if (waitingParty === null || waitingParty.partyId !== partyId || room === undefined) return;
    const { launch } = waitingParty;
    waitingParty = null;
    void routes.join(room, launch, false);
  });

  return {
    ready() {
      mounted = true;
      const q = queued;
      queued = null;
      if (q === null) return false;
      void route(q);
      return true;
    },
    get pending() {
      return queued !== null;
    },
  };
}
