/**
 * kit/testing: saves, stats, boards, the account and the Resume slot.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from hub.md: offline, `getSave` rejects with code
 * `save_unknown` for a slot this device never saw (never `save: null`);
 * writes queue offline; `resume.save` returns false in a race, a daily or a
 * room; a run saved with another version reads as null.
 */
import type {
  GamePayload,
  Json,
  MeResponse,
  ResumeBlocker,
  ResumeLoadOptions,
  ResumeSaveInput,
  Save,
  StatResult,
  SubmitScoreOptions,
  SubmitScoreResult,
} from '@diffenderfer-games/hub';
import type { ResumeLike } from '../core/hub-like.ts';
import { isJson } from '../core/json.ts';
import type { CallLog } from './calls.ts';
import { fakeHubError } from './fake-room.ts';

/** A signed-in player in the fake. */
export type FakeUser = { id: number; username: string; guest: boolean };

/** The fake's progress store: one per account, like the hub. */
export class FakeProgress {
  user: FakeUser | null;
  offline = false;
  /** Slots this device has seen from the hub (offline reads only answer for these). */
  readonly seen = new Set<string>();
  /** Reads that fail before one succeeds (a flaky network). */
  failReads = 0;
  /** Delay before a read answers (the test awaits `clock.advance`). */
  readDelay: Promise<void> | null = null;
  /** Saves by account id (`0` = signed out), then slot. */
  readonly saves = new Map<number, Map<string, { data: Json; updatedAt: number }>>();
  readonly stats = new Map<string, number>();
  private readonly log: CallLog;
  private readonly now: () => number;

  constructor(log: CallLog, user: FakeUser | null, now: () => number) {
    this.log = log;
    this.user = user;
    this.now = now;
  }

  private slots(): Map<string, { data: Json; updatedAt: number }> {
    const id = this.user?.id ?? 0;
    let m = this.saves.get(id);
    if (!m) {
      m = new Map();
      this.saves.set(id, m);
    }
    return m;
  }

  /** Put a save in the cloud (as another device would). */
  seed(slot: string, data: Json, userId = this.user?.id ?? 0): void {
    const id = userId;
    const m = this.saves.get(id) ?? new Map<string, { data: Json; updatedAt: number }>();
    m.set(slot, { data, updatedAt: this.now() });
    this.saves.set(id, m);
    this.seen.add(slot);
  }

  me(): Promise<MeResponse> {
    return Promise.resolve({ user: this.user, profiles: [] });
  }

  async getSave(slot: string): Promise<{ save: Save | null }> {
    this.log.record('getSave', slot);
    if (this.readDelay) await this.readDelay;
    if (this.failReads > 0) {
      this.failReads--;
      throw fakeHubError('network', { status: 503 });
    }
    if (this.offline && !this.seen.has(slot)) throw fakeHubError('save_unknown', { status: 0 });
    const s = this.slots().get(slot);
    this.seen.add(slot);
    return { save: s ? { slot, label: null, updatedAt: s.updatedAt, data: s.data } : null };
  }

  putSave<TData extends GamePayload = Json>(
    slot: string,
    saveData: TData,
    label?: string,
  ): Promise<{ ok: true; updatedAt: number }> {
    this.log.record('putSave', slot, saveData, label);
    const data: unknown = JSON.parse(JSON.stringify(saveData));
    if (!isJson(data)) throw fakeHubError('bad_request', { status: 400 });
    const updatedAt = this.now();
    this.slots().set(slot, { data, updatedAt });
    this.seen.add(slot);
    return Promise.resolve({ ok: true, updatedAt });
  }

  deleteSave(slot: string): Promise<{ ok: true }> {
    this.log.record('deleteSave', slot);
    this.slots().delete(slot);
    return Promise.resolve({ ok: true });
  }

  submitScore<TMeta extends GamePayload = Json>(
    boardKey: string,
    score: number,
    opts?: SubmitScoreOptions<TMeta>,
  ): Promise<SubmitScoreResult> {
    this.log.record('submitScore', boardKey, score, opts);
    return Promise.resolve({
      board: { key: boardKey, title: opts?.title ?? boardKey, sortDir: opts?.sort ?? 'desc' },
      best: score,
      rank: 1,
    });
  }

  incrStat(key: string, amount = 1): Promise<StatResult> {
    this.log.record('incrStat', key, amount);
    const value = (this.stats.get(key) ?? 0) + amount;
    this.stats.set(key, value);
    return Promise.resolve({ key, value });
  }

  maxStat(key: string, value: number): Promise<StatResult> {
    this.log.record('maxStat', key, value);
    const v = Math.max(this.stats.get(key) ?? -Infinity, value);
    this.stats.set(key, v);
    return Promise.resolve({ key, value: v });
  }
}

/** The fake `hub.resume`. */
export class FakeResume implements ResumeLike {
  requested: boolean;
  stored: (ResumeSaveInput<GamePayload> & { savedAt: number }) | null = null;
  /** Delay before `load` answers (the late-load race). */
  loadDelay: Promise<void> | null = null;
  private readonly log: CallLog;
  private readonly host: { blocker(): ResumeBlocker | null; now(): number };

  constructor(log: CallLog, host: { blocker(): ResumeBlocker | null; now(): number }, requested: boolean) {
    this.log = log;
    this.host = host;
    this.requested = requested;
  }

  get blockedBy(): ResumeBlocker | null {
    return this.host.blocker();
  }

  save<TState extends GamePayload>(run: ResumeSaveInput<TState>): boolean {
    if (this.blockedBy !== null) {
      this.log.record('resume.save.blocked', this.blockedBy);
      return false;
    }
    this.log.record('resume.save', run);
    this.stored = { ...run, savedAt: this.host.now() };
    return true;
  }

  flush(): Promise<void> {
    this.log.record('resume.flush');
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.log.record('resume.clear');
    this.stored = null;
    return Promise.resolve();
  }

  async load(options?: ResumeLoadOptions): Promise<GamePayload | null> {
    this.log.record('resume.load', options?.version);
    if (this.loadDelay) await this.loadDelay;
    const s = this.stored;
    if (!s) return null;
    if (options?.version !== undefined && (s.version ?? 0) !== options.version) return null;
    return s.state;
  }
}
