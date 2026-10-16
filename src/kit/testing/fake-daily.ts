/**
 * kit/testing: daily challenges, with days in progress.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from the hub client (src/daily/daily-system.ts) and
 * hub.md "Days in progress": a start before `define` waits for it; a started
 * day is a saved game (`instanceId`) that starting it again picks up with
 * `challenge.saved` (`resumed: true`); `save` keeps the day's state; `cancel`
 * pauses (the day stays in progress), `discard` gives it up, `resume(id)`
 * picks it up by its id; `complete` ends the daily at the call, finishes the
 * day's saved game and resolves `null` when queued offline; a completed day
 * replays for fun (`alreadyCompleted`, no `instanceId`). Offline the fake
 * answers a start with `hub:daily-error` (the kit then plays it unrecorded).
 * The hub's own seed (`seedForDay`) is used, so a fake day is the real day's
 * puzzle.
 */
import type {
  DailyChallenge,
  DailyCompleteResponse,
  DailyCompletionMeta,
  DailyDefinition,
  DailySaveInput,
  DailyStatus,
  GamePayload,
  SavedEntry,
} from '@diffenderfer-games/hub';
import type { DailyLike } from '../core/hub-like.ts';
import { emitWindow } from '../core/events.ts';
import { seedForDay } from '../rng/index.ts';
import type { CallLog } from './calls.ts';
import { savedEntry } from './fake-saved.ts';

/** What the fake daily needs from its hub. */
export type FakeDailyHost = {
  readonly slug: string;
  readonly offline: boolean;
  readonly events: EventTarget;
  today(): string;
  now(): number;
  /** "Your games" changed. */
  changed(): void;
};

/** A day in progress: its saved game. */
type DayInProgress = {
  instanceId: string;
  day: string;
  saved: GamePayload | null;
  savedVersion: number;
  progress: { label: string; fraction: number | null };
  title: string | null;
  updatedAt: number;
};

/** The fake `hub.daily` plus drivers. */
export class FakeDaily implements DailyLike {
  active: DailyChallenge | null = null;
  private play: DailyDefinition['play'] | null = null;
  private pendingDay: string | null = null;
  private pendingInstance: string | null = null;
  private count = 0;
  /** Days in progress, by day. */
  private readonly days = new Map<string, DayInProgress>();
  /** Days completed (what `status()` reports). */
  private readonly completions: DailyStatus['completions'] = {};
  private readonly log: CallLog;
  private readonly host: FakeDailyHost;

  constructor(log: CallLog, host: FakeDailyHost) {
    this.log = log;
    this.host = host;
  }

  get isDefined(): boolean {
    return this.play !== null;
  }

  define(definition: DailyDefinition): void {
    this.log.record('daily.define');
    this.play = definition.play;
    const day = this.pendingDay;
    const instance = this.pendingInstance;
    this.pendingDay = null;
    this.pendingInstance = null;
    if (day !== null) void this.startAndPlay(day);
    else if (instance !== null) void this.resume(instance);
  }

  async startAndPlay(day: string): Promise<void> {
    this.log.record('daily.startAndPlay', day);
    if (this.play === null) {
      this.pendingDay = day;
      return;
    }
    await Promise.resolve();
    if (this.host.offline) {
      emitWindow('hub:daily-error', { day, error: 'offline' }, this.host.events);
      return;
    }
    if (this.completions[day] !== undefined) {
      this.begin({ ...this.challenge(day), alreadyCompleted: true, instanceId: null, saved: null, savedVersion: 0 });
      return;
    }
    const existing = this.days.get(day);
    this.begin(this.challengeFor(existing ?? this.newDay(day), existing !== undefined));
  }

  async resume(instanceId: string): Promise<void> {
    this.log.record('daily.resume', instanceId);
    if (this.active?.instanceId === instanceId) return;
    if (this.play === null) {
      this.pendingInstance = instanceId;
      return;
    }
    await Promise.resolve();
    const entry = [...this.days.values()].find((d) => d.instanceId === instanceId);
    if (entry === undefined) {
      emitWindow('hub:daily-error', { day: '', error: 'not_found' }, this.host.events);
      return;
    }
    this.begin(this.challengeFor(entry, true));
  }

  save(input: DailySaveInput): boolean {
    this.log.record('daily.save', input);
    const entry = this.activeDay();
    if (entry === undefined) return false;
    entry.saved = input.state;
    entry.savedVersion = input.version ?? 0;
    entry.progress = { label: input.progress.label, fraction: input.progress.fraction ?? null };
    entry.title = input.title ?? null;
    entry.updatedAt = this.host.now();
    this.host.changed();
    return true;
  }

  inProgress(): Promise<SavedEntry[]> {
    return Promise.resolve(this.entries());
  }

  async discard(): Promise<void> {
    this.log.record('daily.discard');
    const challenge = this.active;
    if (challenge === null) return;
    this.active = null;
    this.days.delete(challenge.day);
    await Promise.resolve();
    emitWindow('hub:daily-discarded', { day: challenge.day, discarded: true }, this.host.events);
    this.host.changed();
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
    this.completions[challenge.day] = { completedAt: this.count, meta };
    this.days.delete(challenge.day);
    this.host.changed();
    emitWindow('hub:daily-complete', { day: challenge.day }, this.host.events);
    return { ok: true, day: challenge.day, count: this.count, rank: 1 };
  }

  cancel(): void {
    this.log.record('daily.cancel');
    const challenge = this.active;
    this.active = null;
    if (challenge !== null) emitWindow('hub:daily-paused', { day: challenge.day, paused: true }, this.host.events);
  }

  status(): Promise<DailyStatus> {
    return Promise.resolve({
      enabled: true,
      today: this.host.today(),
      completions: { ...this.completions },
      inProgress: [...this.days.keys()],
    });
  }

  // ---- for the other fakes ---------------------------------------------------

  /** This game's days in progress as "Your games" rows. */
  entries(): SavedEntry[] {
    return [...this.days.values()].map((d) =>
      savedEntry(
        {
          id: d.instanceId,
          kind: 'daily',
          title: d.title,
          progress: d.progress,
          version: d.savedVersion,
          updatedAt: d.updatedAt,
          daily: { day: d.day, seed: seedForDay(this.host.slug, d.day) },
        },
        this.host.slug,
      ),
    );
  }

  /** Give up a day in progress by its id ("Your games" → Discard). */
  discardInstance(instanceId: string): boolean {
    const entry = [...this.days.values()].find((d) => d.instanceId === instanceId);
    if (entry === undefined) return false;
    this.days.delete(entry.day);
    if (this.active?.instanceId === instanceId) this.active = null;
    return true;
  }

  /** `hub.resume.clear()` during a daily: the day starts over from its seed. */
  restartActive(): void {
    const entry = this.activeDay();
    if (entry === undefined) return;
    entry.saved = null;
    entry.savedVersion = 0;
    entry.progress = { label: 'Started', fraction: null };
    this.host.changed();
  }

  // ---- drivers -------------------------------------------------------------

  /** The menu (or a `?daily=` deep link) starts `day`. */
  start(day: string = this.host.today()): Promise<void> {
    return this.startAndPlay(day);
  }

  /** A day already in progress (saved on another visit); returns its id. */
  inProgressDay(day: string, saved: GamePayload | null = null, version = 0): string {
    const entry = this.newDay(day);
    entry.saved = saved;
    entry.savedVersion = version;
    return entry.instanceId;
  }

  private activeDay(): DayInProgress | undefined {
    const id = this.active?.instanceId ?? null;
    return id === null ? undefined : [...this.days.values()].find((d) => d.instanceId === id);
  }

  private newDay(day: string): DayInProgress {
    const entry: DayInProgress = {
      instanceId: `sg_daily_${day}`,
      day,
      saved: null,
      savedVersion: 0,
      progress: { label: 'Started', fraction: null },
      title: null,
      updatedAt: this.host.now(),
    };
    this.days.set(day, entry);
    this.host.changed();
    return entry;
  }

  private challenge(day: string): Pick<DailyChallenge, 'day' | 'seed' | 'token'> {
    return { day, seed: seedForDay(this.host.slug, day), token: `token-${day}` };
  }

  private challengeFor(d: DayInProgress, resumed: boolean): DailyChallenge {
    return {
      ...this.challenge(d.day),
      alreadyCompleted: false,
      instanceId: d.instanceId,
      saved: d.saved,
      savedVersion: d.savedVersion,
      resumed,
    };
  }

  private begin(challenge: DailyChallenge): void {
    const play = this.play;
    if (play === null) return;
    this.active = challenge;
    const detail = { day: challenge.day, seed: challenge.seed, resumed: challenge.resumed === true };
    emitWindow('hub:daily-started', detail, this.host.events);
    if (challenge.resumed === true) emitWindow('hub:daily-resumed', detail, this.host.events);
    play({ ...challenge });
  }
}
