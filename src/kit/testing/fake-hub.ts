/**
 * kit/testing: FakeHub, a `HubLike` that records every call and lets a test drive hub events.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 *   const fake = createFakeHub({ user: { id: 7, username: 'Sam', guest: false } });
 *   defineGame(fake, game, { clock: fake.clock });
 *   fake.openOverlay('menu');                 // the hub menu opens
 *   expect(fake.log.names()).toContain('overlay.open');
 *
 * Fidelity comes from the hub's docs and client source (each fake says
 * which); `tests/kit/testing/contract.test.ts` keeps the types honest and the
 * browser suite `tests/hub/fake-parity.test.ts` compares behaviour.
 */
import type { HubStatus, ResumeBlocker } from '@diffenderfer-games/hub';
import { emitWindow } from '../core/events.ts';
import type { HubLike } from '../core/hub-like.ts';
import { CallLog } from './calls.ts';
import { fakeClock, type FakeClock } from './fake-clock.ts';
import { FakeDaily } from './fake-daily.ts';
import { FakeInput } from './fake-input.ts';
import { FakeOverlay } from './fake-overlay.ts';
import { FakeAvatar, FakeSaved, FakeTurns } from './fake-planned.ts';
import { FakeProgress, FakeResume, type FakeUser } from './fake-progress.ts';
import { FakeRace } from './fake-race.ts';
import { FakeRooms } from './fake-room.ts';
import { FakeMenu, FakeMp, FakeNotify, FakePresence, FakeSocial } from './fake-social.ts';

/** Which planned hub APIs the fake has (each off by default, like the published client). */
export type PlannedFlags = { savedGames?: boolean; turns?: boolean; avatars?: boolean; world?: boolean };

/** How to build a FakeHub. */
export type FakeHubOptions = {
  slug?: string;
  /** The signed-in player (default: a claimed player, id 1). `null` = signed out. */
  user?: FakeUser | null;
  offline?: boolean;
  /** The page was opened from the Resume card (`?hub_resume=1`). */
  resumeRequested?: boolean;
  clock?: FakeClock;
  /** Where window events go (default: `window` under jsdom, else a private target). */
  events?: EventTarget;
  planned?: PlannedFlags;
};

/** The fake hub: a `HubLike` plus drivers. */
export class FakeHub implements HubLike {
  readonly slug: string;
  readonly log = new CallLog();
  readonly clock: FakeClock;
  readonly events: EventTarget;
  readonly input: FakeInput;
  readonly overlay: FakeOverlay;
  readonly menu: FakeMenu;
  readonly progress: FakeProgress;
  readonly daily: FakeDaily;
  readonly resume: FakeResume;
  readonly race: FakeRace;
  readonly mp: FakeMp;
  readonly rooms: FakeRooms;
  readonly social: FakeSocial;
  readonly presence: FakePresence;
  readonly notify: FakeNotify;
  readonly saved?: FakeSaved;
  readonly turns?: FakeTurns;
  readonly avatar?: FakeAvatar;
  private readonly statusListeners = new Set<(s: HubStatus) => void>();

  constructor(o: FakeHubOptions = {}) {
    this.slug = o.slug ?? 'mygame';
    this.clock = o.clock ?? fakeClock();
    this.events = o.events ?? (typeof window === 'undefined' ? new EventTarget() : window);
    const userId = o.user === null ? 0 : (o.user?.id ?? 1);
    const planned = o.planned ?? {};
    this.input = new FakeInput(this.log);
    this.overlay = new FakeOverlay(this.log, {
      onOpen: () => this.input.suspendPlay(),
      onClose: () => this.input.releasePlay(),
      events: this.events,
    });
    this.menu = new FakeMenu(this.log);
    this.progress = new FakeProgress(
      this.log,
      o.user === undefined ? { id: 1, username: 'Player1', guest: false } : o.user,
      () => this.clock.now(),
    );
    this.progress.offline = o.offline === true;
    const hubOffline = (): boolean => this.progress.offline;
    const host = { slug: this.slug, events: this.events, now: () => this.clock.now(), today: () => this.today() };
    this.daily = new FakeDaily(
      this.log,
      {
        ...host,
        get offline() {
          return hubOffline();
        },
      },
      planned.savedGames === true,
    );
    this.race = new FakeRace(this.log, host);
    this.rooms = new FakeRooms(this.log, {
      slug: this.slug,
      userId,
      get offline() {
        return hubOffline();
      },
    });
    this.resume = new FakeResume(
      this.log,
      { blocker: () => this.blocker(), now: () => this.clock.now() },
      o.resumeRequested === true,
    );
    this.mp = new FakeMp(
      this.log,
      { slug: this.slug, userId, setCanPause: (v) => this.overlay.setCanPause(v) },
      planned.world === true,
    );
    this.social = new FakeSocial(this.log);
    this.presence = new FakePresence(this.log);
    this.notify = new FakeNotify(this.log);
    if (planned.savedGames === true) this.saved = new FakeSaved(this.log);
    if (planned.turns === true) this.turns = new FakeTurns(this.log);
    if (planned.avatars === true) this.avatar = new FakeAvatar(this.log, userId);
  }

  get isOffline(): boolean {
    return this.progress.offline;
  }

  // ---- HubLike: progress -----------------------------------------------------

  me = (): ReturnType<FakeProgress['me']> => this.progress.me();
  getSave = (slot: string): ReturnType<FakeProgress['getSave']> => this.progress.getSave(slot);
  putSave: FakeProgress['putSave'] = (slot, data, label) => this.progress.putSave(slot, data, label);
  deleteSave = (slot: string): ReturnType<FakeProgress['deleteSave']> => this.progress.deleteSave(slot);
  submitScore: FakeProgress['submitScore'] = (key, score, opts) => this.progress.submitScore(key, score, opts);
  incrStat = (key: string, amount?: number): ReturnType<FakeProgress['incrStat']> =>
    this.progress.incrStat(key, amount);
  maxStat = (key: string, value: number): ReturnType<FakeProgress['maxStat']> => this.progress.maxStat(key, value);

  onStatus(listener: (status: HubStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // ---- drivers ---------------------------------------------------------------

  /** Every call so far, in order. */
  get calls(): CallLog['calls'] {
    return this.log.calls;
  }

  /** Open hub UI (default the menu); returns its close. */
  openOverlay(reason: Parameters<FakeOverlay['push']>[0] = 'menu'): () => void {
    return this.overlay.push(reason);
  }

  /** The player logs in or out from the menu (`hub:auth`). */
  auth(user: FakeUser | null): void {
    this.progress.user = user;
    emitWindow('hub:auth', { user: user === null ? null : { id: user.id, guest: user.guest } }, this.events);
  }

  /** The menu's "Reset game" (`hub:reset`), before the hub reloads the page. */
  reset(): void {
    emitWindow('hub:reset', { slug: this.slug }, this.events);
  }

  goOffline(): void {
    this.progress.offline = true;
    emitWindow('hub:offline', {}, this.events);
    this.emitStatus();
  }

  goOnline(): void {
    this.progress.offline = false;
    emitWindow('hub:online', {}, this.events);
    this.emitStatus();
  }

  /** The menu button was shown or hidden by someone else (`hub:menu-visibility`). */
  menuVisible(visible: boolean): void {
    emitWindow('hub:menu-visibility', { visible }, this.events);
  }

  /** The social runtime loaded (`hub:rt-ready`) or failed (`hub:rt-failed`). */
  runtime(ok: boolean): void {
    emitWindow(ok ? 'hub:rt-ready' : 'hub:rt-failed', {}, this.events);
  }

  /** Today's UTC day key on the fake clock. */
  today(): string {
    return new Date(this.clock.now()).toISOString().slice(0, 10);
  }

  /** Why `resume.save` is blocked right now (race, room, daily), like the client. */
  blocker(): ResumeBlocker | null {
    if (this.race.live) return 'race';
    if (this.rooms.current !== null && !this.rooms.current.left && this.rooms.current.info.phase !== 'ended')
      return 'room';
    if (this.daily.active !== null) return 'daily';
    return null;
  }

  private emitStatus(): void {
    const s: HubStatus = { online: !this.progress.offline, offline: this.progress.offline, pending: 0 };
    for (const l of this.statusListeners) l(s);
  }
}

/** A fresh FakeHub. */
export function createFakeHub(o: FakeHubOptions = {}): FakeHub {
  return new FakeHub(o);
}
