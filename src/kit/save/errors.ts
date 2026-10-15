/**
 * kit/save: what a failed hub read means for the guards.
 * Source: dg-template src/kit/save/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/save.md § "The guards"
 *
 * The kit never imports the hub's error classes (that would pull the client
 * into unit tests); it reads the fields every `HubError` has.
 */
import { field, numField, strField } from '../core/json.ts';

/** The hub's offline "never saw this slot" code (hub.md "Saves offline"). */
export const SAVE_UNKNOWN = 'save_unknown';

/**
 * How a failed read is treated:
 * - `nothing`: signed out (401): there is no cloud copy to protect, play locally;
 * - `unknown`: offline and never seen, or any other failure: the cloud copy may
 *   exist, so nothing is pushed until a later read succeeds.
 */
export function readFailure(e: unknown): 'nothing' | 'unknown' {
  if (numField(e, 'status', -1) === 401) return 'nothing';
  return 'unknown';
}

/** Is this the hub's `save_unknown` (offline, never seen)? */
export function isSaveUnknown(e: unknown): boolean {
  return strField(e, 'code') === SAVE_UNKNOWN;
}

/** Is this an offline failure (no network)? */
export function isOfflineError(e: unknown): boolean {
  return field(e, 'isOffline') === true || strField(e, 'code') === 'offline' || strField(e, 'name') === 'OfflineError';
}
