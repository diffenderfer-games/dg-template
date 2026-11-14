/**
 * kit/online: the room wire format, validation, the successor and host backups (uno wire.ts).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Wire"
 *
 * Pure: also runs under Node (a game's own server or sim).
 */
import type { RoomInfo } from '@diffenderfer-games/hub';
import { field, isJson, numField, strField, type Json } from '../core/json.ts';

/** Bump when the envelope changes: other versions are dropped, not misread. */
export const WIRE_VERSION = 1;

/** The relay's limit per message (multiplayer.md §8 "Limits"). */
export const MAX_MESSAGE_BYTES = 8 * 1024;

/**
 * Message kinds: a player's input, the public view, a private view, a host backup (to the successor);
 * a host back without its match asks for it (`want`), and a guest holding a backup hands it back (`handoff`).
 */
export type WireKind = 'in' | 'view' | 'pview' | 'backup' | 'want' | 'handoff';

/**
 * One room message. A backup and a handoff also carry the match's id (`m`), the room `seq` of the last
 * input in the state (`q`: older inputs replayed to a returning host are not applied twice) and the seats
 * the computer plays (`cs`). Pages of an older kit ignore the extra fields and kinds.
 */
export type Envelope = { v: number; t: WireKind; d: Json; at: number; m?: string; q?: number; cs?: number[] };

const KINDS: readonly string[] = ['in', 'view', 'pview', 'backup', 'want', 'handoff'];

/** Wrap data for sending. */
export function envelope(t: WireKind, d: Json, at: number): Envelope {
  return { v: WIRE_VERSION, t, d, at };
}

/** A host's whole match, to carry it over a reload: its state, when, its id, the last input in it, the computer's seats. */
export type Carry = { s: Json; at: number; m: string | null; q: number; cs: number[] };

/** A backup or a handoff of a match. */
export function carryEnvelope(t: 'backup' | 'handoff', c: Carry): Envelope {
  return { ...envelope(t, c.s, c.at), ...(c.m === null ? {} : { m: c.m }), q: c.q, cs: c.cs };
}

/** The match a backup or a handoff carries. */
export function carryOf(e: Envelope): Carry {
  return { s: e.d, at: e.at, m: e.m ?? null, q: e.q ?? 0, cs: e.cs ?? [] };
}

const isSeatList = (x: unknown): x is number[] => Array.isArray(x) && x.every((n) => typeof n === 'number');

/** A host's saved copy of its match in room `roomId` (null: another room's, or not one). */
export function savedCarry(x: unknown, roomId: string): Carry | null {
  const s = field(x, 's');
  const cs = field(x, 'cs');
  const m = field(x, 'm');
  if (strField(x, 'room') !== roomId || !isJson(s) || !isSeatList(cs)) return null;
  return { s, at: numField(x, 'at'), m: typeof m === 'string' ? m : null, q: numField(x, 'q'), cs };
}

/** Is this envelope small enough to send? */
export function fits(e: Envelope): boolean {
  return new TextEncoder().encode(JSON.stringify(e)).length <= MAX_MESSAGE_BYTES;
}

/** Read an untrusted room message (null: another version, an unknown kind, or not one of ours). */
export function parseEnvelope(x: unknown): Envelope | null {
  if (numField(x, 'v', -1) !== WIRE_VERSION) return null;
  const t = strField(x, 't');
  const d = field(x, 'd');
  if (!KINDS.includes(t) || !isJson(d)) return null;
  const kind = KINDS.find((k): k is WireKind => k === t);
  if (kind === undefined) return null;
  const m = field(x, 'm');
  const q = field(x, 'q');
  const cs = field(x, 'cs');
  return {
    v: WIRE_VERSION,
    t: kind,
    d,
    at: numField(x, 'at'),
    ...(typeof m === 'string' ? { m } : {}),
    ...(typeof q === 'number' ? { q } : {}),
    ...(isSeatList(cs) ? { cs } : {}),
  };
}

/**
 * Who takes over if the host leaves: the longest-seated connected player who
 * isn't the host (the hub's own rule, multiplayer.md §8 "Lobby").
 */
export function successorOf(info: Pick<RoomInfo, 'seats' | 'hostId'>): number | null {
  return info.seats.find((s) => s.userId !== info.hostId && s.connected)?.userId ?? null;
}

/** The newest backup of several (uno freshest). */
export function freshest<B extends { at: number }>(backups: readonly B[]): B | null {
  let best: B | null = null;
  for (const b of backups) if (best === null || b.at > best.at) best = b;
  return best;
}
