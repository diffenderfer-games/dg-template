/**
 * kit/save: device-local settings (sound, music, haptics…), typed and versioned.
 * Source: dg-template src/kit/save/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/save.md § "Settings"
 *
 * Settings belong to the device, not the account (bfme settings.ts): a phone
 * can be muted while the laptop isn't. They never go to the hub.
 */
import { field, isJson, isJsonObject, numField, type Json, type JsonObject } from '../core/json.ts';
import type { Store } from '../core/store.ts';

/** What a settings store needs. */
export type SettingsSpec<S extends JsonObject> = {
  /** The storage key, e.g. `${slug}:settings`. */
  key: string;
  version: number;
  defaults(): S;
  /** Older or partial data → the current shape (default: defaults with known keys copied over). */
  migrate?(old: Json, fromVersion: number): S;
};

/** The live settings. */
export type SettingsStore<S extends JsonObject> = {
  readonly data: Readonly<S>;
  set(patch: Partial<S>): void;
  onChange(cb: (s: Readonly<S>) => void): () => void;
};

/** Copy the keys of `defaults` from `old` where the type matches. */
function fillFrom<S extends JsonObject>(defaults: S, old: Json): S {
  const out: JsonObject = { ...defaults };
  for (const [k, v] of Object.entries(defaults)) {
    const o = field(old, k);
    if (typeof o === typeof v && isJson(o)) out[k] = o;
  }
  return Object.assign(defaults, out);
}

/** Load (or create) the device's settings. */
export function createSettings<S extends JsonObject>(spec: SettingsSpec<S>, store: Store): SettingsStore<S> {
  const saved = store.getJson(spec.key);
  const v = numField(saved, 'v', -1);
  const raw = field(saved, 'data');
  let data: S;
  if (saved === undefined || !isJsonObject(raw)) data = spec.defaults();
  else if (v === spec.version) data = fillFrom(spec.defaults(), raw);
  else data = spec.migrate?.(raw, v) ?? fillFrom(spec.defaults(), raw);
  const listeners = new Set<(s: Readonly<S>) => void>();
  return {
    get data() {
      return data;
    },
    set(patch) {
      data = { ...data, ...patch };
      store.setJson(spec.key, { v: spec.version, data });
      for (const cb of listeners) cb(data);
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
