/**
 * kit/save: the guarded profile (long-term progress, synced to the hub's save slot).
 * Source: dg-template src/kit/save/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/save.md
 *
 * Every guard has a regression test (tests/kit/save/profile.test.ts):
 * 1. no push before the cloud read answers;
 * 2. a failed or `save_unknown` read is "unknown", not "empty": nothing is pushed
 *    until a later read succeeds (401 = signed out: nothing to protect);
 * 3. progress earned during a slow load is merged, not lost;
 * 4. a push re-reads and merges onto the latest copy, one at a time, and never
 *    writes over a copy it couldn't read (or one saved by a newer version);
 * 5. an account switch cancels the pending push, re-reads, and never carries
 *    one account's progress into another (a guest's carries into its account);
 * 6. legacy local keys fold in once;
 * 7. `hub:reset` wipes the game's local copies;
 * 8. a daily, race or online game never writes the profile (unless `allowInDaily`).
 */
import type { Activity } from '../core/activity.ts';
import { serialQueue, type Clock } from '../core/index.ts';
import { onWindow, type AuthUser } from '../core/events.ts';
import type { HubLike } from '../core/hub-like.ts';
import { jsonEqual, type JsonObject } from '../core/json.ts';
import { ruleBroken } from '../core/log.ts';
import type { Store } from '../core/store.ts';
import { readFailure } from './errors.ts';
import { createProfileLocal } from './profile-local.ts';
import { replaceContents, unwrapProfile, wrapProfile, type ProfileSpec } from './profile-spec.ts';

/** Where the profile stands with the cloud copy. */
export type ProfileState = 'loading' | 'ready' | 'unknown';

/** The live profile. */
export type ProfileStore<P extends JsonObject> = {
  /** Usable at once (defaults or the local copy); updated in place when the cloud copy loads. */
  readonly data: P;
  readonly state: ProfileState;
  /** Change the profile and schedule a guarded push. */
  update(fn: (p: P) => void, opts?: { allowInDaily?: boolean }): void;
  /** Resolves once the first read finished (ready or unknown). */
  ready(): Promise<void>;
  /** Push now if anything is waiting (page hidden or closed). */
  flush(): Promise<void>;
  /** Called after every change (local or loaded). */
  onChange(cb: (p: P) => void): () => void;
  dispose(): void;
};

/** What the profile needs besides the hub. */
export type ProfileDeps = { slug: string; clock: Clock; activity: Activity; store: Store; events: EventTarget };

/** Create the guarded profile and start loading it. */
export function createProfile<P extends JsonObject>(
  hub: Pick<HubLike, 'getSave' | 'putSave' | 'me' | 'onStatus'>,
  spec: ProfileSpec<P>,
  deps: ProfileDeps,
): ProfileStore<P> {
  const slot = spec.slot ?? 'main';
  const local = createProfileLocal(spec, deps.slug, deps.store);
  const data: P = spec.defaults();
  let state: ProfileState = 'loading';
  let account: AuthUser | null = null;
  let epoch = 0; // bumped on every account switch: async steps from an older account stop
  let dirty = false;
  let cancelPush: (() => void) | null = null;
  let resolveReady: () => void = () => undefined;
  let readyPromise = new Promise<void>((r) => (resolveReady = r));
  const listeners = new Set<(p: P) => void>();
  const serial = serialQueue(deps.clock);
  const changed = (): void => {
    for (const cb of listeners) cb(data);
  };

  async function load(): Promise<void> {
    const e = epoch;
    state = 'loading';
    try {
      const me = await hub.me();
      if (e !== epoch) return;
      account = me.user === null ? null : { id: me.user.id, guest: me.user.guest === true };
    } catch {
      account = null;
    }
    const mirrored = local.read(account?.id ?? null);
    if (mirrored) replaceContents(data, spec.merge(mirrored, data));
    if (local.foldLegacy(data)) dirty = true;
    try {
      const res = await hub.getSave(slot);
      if (e !== epoch) return;
      const cloud = unwrapProfile(spec, res.save?.data);
      if (cloud.kind === 'newer') {
        state = 'unknown'; // another tab runs a newer version: never write over it
      } else {
        if (cloud.kind === 'ok') {
          const merged = spec.merge(cloud.data, data);
          if (!jsonEqual(merged, cloud.data)) dirty = true;
          replaceContents(data, merged);
        } else if (dirty || !jsonEqual(data, spec.defaults())) {
          dirty = true; // nothing usable in the cloud: seed it with this device's progress
        }
        state = 'ready';
      }
    } catch (err) {
      if (e !== epoch) return;
      state = readFailure(err) === 'nothing' ? 'ready' : 'unknown';
    }
    local.write(account?.id ?? null, data);
    changed();
    resolveReady();
    if (state === 'ready' && dirty) schedule();
  }

  /** Re-read, merge onto the latest copy, write. One at a time; abandoned on an account switch. */
  function push(): Promise<void> {
    return serial(async () => {
      if (state !== 'ready' || !dirty) return;
      const e = epoch;
      let latest;
      try {
        latest = unwrapProfile(spec, (await hub.getSave(slot)).save?.data);
      } catch {
        return; // couldn't read: never write over an unread copy (stays dirty)
      }
      if (e !== epoch || latest.kind === 'newer') return;
      const next = latest.kind === 'ok' ? spec.merge(latest.data, data) : structuredClone(data);
      dirty = false;
      try {
        await hub.putSave(slot, wrapProfile(spec.version, next));
      } catch {
        if (e === epoch) dirty = true; // queued offline by the hub, or refused: try again later
        return;
      }
      if (e !== epoch) return;
      replaceContents(data, spec.merge(next, data));
      local.write(account?.id ?? null, data);
    });
  }

  function schedule(): void {
    cancelPush?.();
    cancelPush = deps.clock.after(spec.debounceMs ?? 1000, () => {
      cancelPush = null;
      void push();
    });
  }

  function switchAccount(user: AuthUser | null): void {
    cancelPush?.();
    cancelPush = null;
    epoch++;
    const carry = account === null || account.guest; // a guest's (or signed-out) progress carries into the account
    if (!carry || user === null) {
      replaceContents(data, spec.defaults());
      dirty = false;
    }
    readyPromise = new Promise<void>((r) => (resolveReady = r));
    void load();
  }

  const offs = [
    onWindow('hub:auth', (d) => switchAccount(d.user), deps.events),
    onWindow(
      'hub:reset',
      () => {
        cancelPush?.();
        local.wipe();
        replaceContents(data, spec.defaults());
        dirty = false;
        changed();
      },
      deps.events,
    ),
    onWindow('hub:online', () => state === 'unknown' && void load(), deps.events),
    hub.onStatus((s) => {
      if (s.online && state === 'unknown') void load();
    }),
  ];

  void load();

  return {
    data,
    get state() {
      return state;
    },
    update(fn, opts) {
      if (deps.activity.isolated() && opts?.allowInDaily !== true) {
        ruleBroken(
          `profile.update during a ${deps.activity.mode ?? ''} game: dailies, races and online play never touch normal progress`,
        );
        return;
      }
      fn(data);
      dirty = true;
      local.write(account?.id ?? null, data);
      changed();
      if (state === 'ready') schedule();
    },
    ready: () => readyPromise,
    flush() {
      cancelPush?.();
      cancelPush = null;
      return push();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      cancelPush?.();
      for (const off of offs) off();
    },
  };
}
