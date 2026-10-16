/**
 * kit/testing: "Your games" (`hub.saved`).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour from the hub client (core/saved/hub-saved.ts) and hub.md "Saved
 * games": the list is this game's saved game (from `hub.resume`), its days in
 * progress (from `hub.daily`) and its online games, online games waiting on
 * the player first, then the newest; `onOpen` handlers take the kinds they
 * asked for (without one the page would reload); `discard` gives a daily or
 * the saved game up; `change` fires when the list changes.
 */
import type { SavedEntry, SavedKind, SavedListOptions, SavedOpenHandler, SavedOpened } from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type { SavedLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';

/** A full saved-game row from the fields a test cares about. */
export function savedEntry(e: Partial<SavedEntry> & Pick<SavedEntry, 'id' | 'kind'>, slug = 'mygame'): SavedEntry {
  return {
    game: slug,
    gameTitle: 'My Game',
    path: `/${slug}`,
    hasImage: false,
    status: 'active',
    title: null,
    progress: { label: 'Started', fraction: null },
    version: 0,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: null,
    ...e,
  };
}

/** Where the fake's rows come from (the fake resume, daily and turns). */
export type FakeSavedHost = {
  readonly slug: string;
  /** The rows the other fakes hold right now. */
  entries(): SavedEntry[];
  /** Give up a row the other fakes hold; false when it isn't theirs. */
  discard(entry: SavedEntry): boolean;
};

/** Online games waiting on the player first (oldest turn first), then the newest. */
function byHubOrder(a: SavedEntry, b: SavedEntry): number {
  const mine = (e: SavedEntry): boolean => e.turns?.isMyTurn === true;
  if (mine(a) !== mine(b)) return mine(a) ? -1 : 1;
  if (mine(a)) return a.updatedAt - b.updatedAt;
  return b.updatedAt - a.updatedAt;
}

/** The fake `hub.saved`. */
export class FakeSaved implements SavedLike {
  /** The game this page was opened for (`?hub_open=`); tests set it before boot. */
  opened: SavedOpened | null = null;
  /** Rows a test added that no other fake holds (another device's, an online game). */
  private extra: SavedEntry[] = [];
  private readonly openHandlers = new Map<SavedOpenHandler, SavedListOptions>();
  private readonly events = new Emitter<{ change: SavedEntry[] }>();
  private readonly log: CallLog;
  private readonly host: FakeSavedHost;

  constructor(log: CallLog, host: FakeSavedHost) {
    this.log = log;
    this.host = host;
  }

  /** Every active row, in the hub's order. */
  private rows(kinds?: readonly SavedKind[]): SavedEntry[] {
    return [...this.host.entries(), ...this.extra]
      .filter((g) => g.status === 'active' && (kinds === undefined || kinds.includes(g.kind)))
      .sort(byHubOrder);
  }

  list(options: SavedListOptions = {}): Promise<SavedEntry[]> {
    this.log.record('saved.list', options.kinds);
    return Promise.resolve(this.rows(options.kinds));
  }

  onOpen(handler: SavedOpenHandler, options: SavedListOptions = {}): () => void {
    this.openHandlers.set(handler, options);
    return () => this.openHandlers.delete(handler);
  }

  open(id: string): Promise<void> {
    this.log.record('saved.open', id);
    const g = this.rows().find((x) => x.id === id);
    if (!g) return Promise.resolve();
    const takers = [...this.openHandlers].filter(([, o]) => o.kinds === undefined || o.kinds.includes(g.kind));
    if (takers.length === 0) this.log.record('saved.reload', id); // the real client reloads with ?hub_open
    for (const [handler] of takers) void handler(g);
    return Promise.resolve();
  }

  discard(id: string): Promise<void> {
    this.log.record('saved.discard', id);
    const g = this.rows().find((x) => x.id === id);
    if (g && !this.host.discard(g)) this.extra = this.extra.filter((x) => x.id !== id);
    this.changed();
    return Promise.resolve();
  }

  on(_event: 'change', cb: (games: SavedEntry[]) => void): () => void {
    return this.events.on('change', cb);
  }

  // ---- drivers -------------------------------------------------------------

  /** Add a row no other fake holds (and tell listeners). */
  add(e: Partial<SavedEntry> & Pick<SavedEntry, 'id' | 'kind'>): SavedEntry {
    const full = savedEntry(e, this.host.slug);
    this.extra.push(full);
    this.changed();
    return full;
  }

  /** The list changed (a save, a finish, a discard, another device). */
  changed(): void {
    this.events.emit('change', this.rows());
  }
}
