/**
 * kit/save: the profile spec a game fills in, and the saved envelope.
 * Source: dg-template src/kit/save/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/save.md
 */
import { field, isJsonObject, numField, type Json, type JsonObject } from '../core/json.ts';

/** What the game tells the kit about its profile (long-term progress: unlocks, bests, coins). */
export type ProfileSpec<P extends JsonObject> = {
  /** The hub save slot (default `main`). */
  slot?: string;
  /** The profile's shape version: bump it and add `migrate` when the shape changes. */
  version: number;
  /** A fresh default profile (a new object every call). */
  defaults(): P;
  /** Combine the cloud copy with this device's: only grows (kit/save merge helpers). */
  merge(cloud: P, local: P): P;
  /** Is this a valid profile of the current version? Invalid cloud data is ignored, never adopted. */
  validate(x: Json): x is P;
  /** Turn an older version's data into the current shape (null: start fresh). */
  migrate?(old: Json, fromVersion: number): P | null;
  /** Keep a copy in localStorage too (per account, owner-tagged). Default true. */
  localMirror?: boolean;
  /** Old pre-hub localStorage keys to fold in once (then kept as `<key>::folded` and removed). */
  legacy?: { keys: string[]; fold(old: Json, into: P): P };
  /** Wait this long after the last change before pushing (default 1000 ms). */
  debounceMs?: number;
};

/** The saved envelope: `{ v, data }`, so a later version can migrate. */
export type ProfileEnvelope = { v: number; data: JsonObject };

/** Wrap a profile for saving. */
export function wrapProfile(version: number, data: JsonObject): ProfileEnvelope {
  return { v: version, data };
}

/** What a saved profile turned out to be. */
export type SavedProfile<P> =
  | { kind: 'none' }
  | { kind: 'ok'; data: P }
  /** Not valid (corrupt, or a shape this version can't read): ignored, never adopted. */
  | { kind: 'invalid' }
  /** Saved by a newer version of the game (another tab updated): never overwritten. */
  | { kind: 'newer' };

/** Read a saved profile: validate, or migrate from an older version. */
export function unwrapProfile<P extends JsonObject>(spec: ProfileSpec<P>, saved: Json | undefined): SavedProfile<P> {
  if (saved === undefined || saved === null) return { kind: 'none' };
  const data = field(saved, 'data');
  const v = numField(saved, 'v', -1);
  if (!isJsonObject(saved) || v < 0 || !isJsonObject(data)) {
    // A bare profile from before the envelope counts as version 0.
    const old = spec.migrate?.(saved, 0) ?? (spec.validate(saved) ? saved : null);
    return old === null ? { kind: 'invalid' } : { kind: 'ok', data: old };
  }
  if (v > spec.version) return { kind: 'newer' };
  if (v === spec.version) return spec.validate(data) ? { kind: 'ok', data } : { kind: 'invalid' };
  const migrated = spec.migrate?.(data, v) ?? null;
  return migrated !== null && spec.validate(migrated) ? { kind: 'ok', data: migrated } : { kind: 'invalid' };
}

/** Replace `target`'s contents with `source`'s (keeps the object identity games hold). */
export function replaceContents(target: JsonObject, source: JsonObject): void {
  for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
  Object.assign(target, structuredClone(source));
}
