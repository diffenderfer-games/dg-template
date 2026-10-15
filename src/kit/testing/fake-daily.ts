/**
 * kit/testing: daily challenges.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from the hub client (src/daily/daily-system.ts): a start
 * before `define` waits for it; `complete` ends the daily at the call and
 * resolves `null` when queued offline; `cancel` just ends it. The hub's own
 * seed (`seedForDay`) is used, so a fake day is the real day's puzzle.
 */
import type {
  DailyChallenge,
  DailyCompleteResponse,
  DailyCompletionMeta,
  DailyDefinition,
  DailyStatus,
} from '@diffenderfer-games/hub';
import type { DailyLike } from '../core/hub-like.ts';
import type { PlannedChallengeExtras } from '../core/planned.ts';
import { emitWindow } from '../core/events.ts';
import { seedForDay } from '../rng/index.ts';
import type { CallLog } from './calls.ts';

/** What the fake daily needs from its hub. */
export type FakeDailyHost = {
  readonly slug: string;
  readonly offline: boolean;
  readonly events: EventTarget;
  today(): string;
};

/** The fake `hub.daily` plus drivers. */
export class FakeDaily implements DailyLike {
  active: DailyChallenge | null = null;
  private play: DailyDefinition['play'] | null = null;
  private pendingDay: string | null = null;
  private count = 0;
  private readonly log: CallLog;
  private readonly host: FakeDailyHost;
  /** Planned (saved-games phase 1): present only when the fake is built with `plannedSavedGames`. */
  save?: DailyLike['save'];
  resume?: DailyLike['resume'];
  discard?: DailyLike['discard'];
  /** Saved state handed to `play` by the planned `resume` (tests set it). */
  savedFor = new Map<string, PlannedChallengeExtras>();

  constructor(log: CallLog, host: FakeDailyHost, planned: boolean) {
    this.log = log;
    this.host = host;
    if (planned) {
      this.save = (run) => {
        this.log.record('daily.save', run);
        return this.active !== null;
      };
      this.resume = (id) => {
        this.log.record('daily.resume', id);
        return this.startAndPlay(id.replace(/^daily:/, ''));
      };
      this.discard = () => {
        this.log.record('daily.discard');
        this.active = null;
      };
    }
  }

  get isDefined(): boolean {
    return this.play !== null;
  }

  define(definition: DailyDefinition): void {
    this.log.record('daily.define');
    this.play = definition.play;
    const day = this.pendingDay;
    this.pendingDay = null;
    if (day !== null) void this.startAndPlay(day);
  }

  async startAndPlay(day: string): Promise<void> {
    this.log.record('daily.startAndPlay', day);
    const play = this.play;
    if (play === null) {
      this.pendingDay = day;
      return;
    }
    await Promise.resolve();
    if (this.host.offline) {
      emitWindow('hub:daily-error', { day, error: 'offline' }, this.host.events);
      return;
    }
    const challenge: DailyChallenge & PlannedChallengeExtras = {
      day,
      seed: seedForDay(this.host.slug, day),
      token: `token-${day}`,
      alreadyCompleted: false,
      ...this.savedFor.get(day),
    };
    this.active = challenge;
    emitWindow('hub:daily-started', { day, seed: challenge.seed }, this.host.events);
    play({ ...challenge });
  }

  async complete(meta: DailyCompletionMeta = {}): Promise<DailyCompleteResponse | null> {
    this.log.record('daily.complete', meta);
    const challenge = this.active;
    if (challenge === null) return null;
    this.active = null;
    await Promise.resolve();
    if (this.host.offline) {
      emitWindow('hub:daily-queued', { day: challenge.day }, this.host.events);
      return null;
    }
    this.count++;
    emitWindow('hub:daily-complete', { day: challenge.day }, this.host.events);
    return { ok: true, day: challenge.day, count: this.count, rank: 1 };
  }

  cancel(): void {
    this.log.record('daily.cancel');
    this.active = null;
  }

  status(): Promise<DailyStatus> {
    return Promise.resolve({ enabled: true, today: this.host.today(), completions: {} });
  }

  // ---- drivers -------------------------------------------------------------

  /** The menu (or a `?daily=` deep link) starts `day`. */
  start(day: string = this.host.today()): Promise<void> {
    return this.startAndPlay(day);
  }
}
