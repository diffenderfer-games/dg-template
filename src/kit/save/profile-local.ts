/**
 * kit/save: the profile's local copy (owner-tagged) and the one-time legacy fold.
 * Source: dg-template src/kit/save/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/save.md § "Local copy"
 */
import { field, isJson, numField, type Json, type JsonObject } from '../core/json.ts';
import { scopedKey, type Store } from '../core/store.ts';
import { unwrapProfile, type ProfileSpec } from './profile-spec.ts';

/** The local side of a profile. */
export type ProfileLocal<P extends JsonObject> = {
  /** This account's local copy, or null (missing, another owner's, or invalid). */
  read(uid: number | null): P | null;
  write(uid: number | null, data: P): void;
  /** Fold old pre-hub keys into `into` once; true when something was folded. */
  foldLegacy(into: P): boolean;
  /** Remove every local key of this game (the menu's "Reset game"). */
  wipe(): void;
};

/** The local copy for `spec` in game `slug`. */
export function createProfileLocal<P extends JsonObject>(
  spec: ProfileSpec<P>,
  slug: string,
  store: Store,
): ProfileLocal<P> {
  const enabled = spec.localMirror !== false;
  const key = (uid: number | null): string => scopedKey(slug, 'profile', uid);
  return {
    read(uid) {
      if (!enabled) return null;
      const saved = store.getJson(key(uid));
      if (saved === undefined || numField(saved, 'owner', -2) !== (uid ?? -1)) return null;
      const profile = field(saved, 'profile');
      const res = unwrapProfile(spec, isJson(profile) ? profile : null);
      return res.kind === 'ok' ? res.data : null;
    },
    write(uid, data) {
      if (!enabled) return;
      store.setJson(key(uid), { owner: uid ?? -1, profile: { v: spec.version, data } });
    },
    foldLegacy(into) {
      const legacy = spec.legacy;
      if (!legacy) return false;
      let folded = false;
      for (const k of legacy.keys) {
        const old: Json | undefined = store.getJson(k);
        if (old === undefined) continue;
        Object.assign(into, legacy.fold(old, into));
        const text = store.getText(k);
        if (text !== null) store.setText(`${k}::folded`, text);
        store.remove(k);
        folded = true;
      }
      return folded;
    },
    wipe() {
      for (const k of store.keys(`${slug}:`)) store.remove(k);
    },
  };
}
