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

/** Message kinds: a player's input, the public view, a private view, a host backup. */
export type WireKind = 'in' | 'view' | 'pview' | 'backup';

/** One room message. */
export type Envelope = { v: number; t: WireKind; d: Json; at: number };

const KINDS: readonly string[] = ['in', 'view', 'pview', 'backup'];

/** Wrap data for sending. */
export function envelope(t: WireKind, d: Json, at: number): Envelope {
  return { v: WIRE_VERSION, t, d, at };
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
  return kind === undefined ? null : { v: WIRE_VERSION, t: kind, d, at: numField(x, 'at') };
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
