/**
 * kit/testing: races.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from multiplayer.md §14: `define` keeps the callbacks;
 * the hub calls `start` on the countdown (again with `resumed: true` after a
 * reload, never for spectators), `end` once decided and `exit` when the
 * player is done. Races write history only: no stats, no boards.
 */
import type {
  RaceCreateOptions,
  RaceDefinition,
  RaceEvents,
  RaceHistoryViewOptions,
  RaceResult,
  RaceStart,
  RaceStats,
  RoomInfo,
} from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import { emitWindow } from '../core/events.ts';
import type { RaceLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';
import { fakeRoomInfo } from './fake-room-info.ts';

/** The fake `hub.race` plus drivers. */
export class FakeRace implements RaceLike {
  definition: RaceDefinition | null = null;
  room: RoomInfo | null = null;
  /** True between a `start` and its `end`/`exit` (the resume blocker reads it). */
  live = false;
  /** What `finish` resolves with (a win by default). */
  finishResult: RaceResult | null = null;
  private readonly events = new Emitter<{ [K in keyof RaceEvents]: RaceEvents[K] }>();
  private readonly log: CallLog;
  private readonly host: { readonly slug: string; readonly events: EventTarget; now(): number };

  constructor(log: CallLog, host: { readonly slug: string; readonly events: EventTarget; now(): number }) {
    this.log = log;
    this.host = host;
  }

  define(definition: RaceDefinition): void {
    this.log.record('race.define');
    this.definition = definition;
  }

  create(options: RaceCreateOptions = {}): Promise<RoomInfo> {
    this.log.record('race.create', options);
    this.room = fakeRoomInfo({ game: this.host.slug, mode: 'race' });
    return Promise.resolve(this.room);
  }

  browse(): void {
    this.log.record('race.browse');
  }

  openHistory(options?: RaceHistoryViewOptions): void {
    this.log.record('race.openHistory', options);
  }

  status(stats: RaceStats, progress?: number): void {
    this.log.record('race.status', stats, progress);
  }

  finish(stats?: RaceStats): Promise<RaceResult | null> {
    this.log.record('race.finish', stats);
    return Promise.resolve(this.finishResult);
  }

  lose(stats?: RaceStats): Promise<void> {
    this.log.record('race.lose', stats);
    return Promise.resolve();
  }

  leave(): Promise<void> {
    this.log.record('race.leave');
    this.live = false;
    this.room = null;
    return Promise.resolve();
  }

  current(): RoomInfo | null {
    return this.room;
  }

  on<K extends keyof RaceEvents>(event: K, listener: (payload: RaceEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  // ---- drivers -------------------------------------------------------------

  /** The countdown began: call the game's `start` (spectators: only the `start` event). */
  start(partial: Partial<RaceStart> = {}): RaceStart {
    const race: RaceStart = {
      roomId: 'race-room',
      round: 1,
      seed: 4242,
      params: {},
      startAt: this.host.now() + 3000,
      players: [1, 2],
      spectator: false,
      resumed: false,
      ...partial,
    };
    this.room ??= fakeRoomInfo({ game: this.host.slug, mode: 'race' });
    this.events.emit('start', race);
    if (!race.spectator) {
      this.live = true;
      this.definition?.start(race);
    }
    return race;
  }

  /** The race was decided. */
  end(result: Partial<RaceResult> = {}): RaceResult {
    const full: RaceResult = {
      id: 1,
      room: 'RACE2',
      round: 1,
      seed: 4242,
      winnerId: 1,
      players: [],
      game: this.host.slug,
      params: {},
      outcome: 'finished',
      startedAt: this.host.now() - 10_000,
      endedAt: this.host.now(),
      durationMs: 10_000,
      ...result,
    };
    this.events.emit('result', full);
    this.definition?.end?.(full);
    return full;
  }

  /** The player pressed Done, or the race closed. */
  exit(): void {
    this.live = false;
    this.room = null;
    this.definition?.exit?.();
  }

  /** The race closed under the player (`closed` event). */
  close(reason = 'removed'): void {
    this.events.emit('closed', { reason });
  }

  /** The race HUD moved (CSS variable + window event, multiplayer.md §14.5). */
  hud(rect: { top?: number; bottom?: number; left?: number; right?: number; visible?: boolean }): void {
    const detail = {
      visible: rect.visible ?? true,
      top: rect.top ?? 0,
      bottom: rect.bottom ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
    };
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--hub-race-hud-top', `${detail.top}px`);
      document.documentElement.style.setProperty('--hub-race-hud-bottom', `${detail.bottom}px`);
    }
    emitWindow('hub:race-hud', detail, this.host.events);
  }
}
