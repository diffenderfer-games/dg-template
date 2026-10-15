/**
 * kit/core: safe storage (localStorage / sessionStorage that never throws).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 *
 * Private mode, a full quota or blocked storage makes every access throw on
 * some browsers. Every read here falls back and every write reports failure,
 * so the game keeps running. Keys are scoped per game and per account.
 */
import { parseJson, type Json } from './json.ts';

/** The part of `Storage` the store uses (a fake in tests). */
export type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** A safe key/value store. */
export type Store = {
  getText(key: string): string | null;
  setText(key: string, value: string): boolean;
  getJson(key: string): Json | undefined;
  setJson(key: string, value: Json): boolean;
  remove(key: string): void;
  /** Every key starting with `prefix`. */
  keys(prefix: string): string[];
};

/** A key for one game, one name and one account: `${slug}:${name}::u${uid}` (`anon` when signed out). */
export function scopedKey(slug: string, name: string, uid: number | null): string {
  return `${slug}:${name}::u${uid ?? 'anon'}`;
}

/** A store over `backing` (resolved lazily; `null` = no storage at all). */
export function createStore(backing: () => KeyValue | null): Store {
  const get = (): KeyValue | null => {
    try {
      return backing();
    } catch {
      return null;
    }
  };
  const store: Store = {
    getText(key) {
      try {
        return get()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setText(key, value) {
      try {
        const kv = get();
        if (!kv) return false;
        kv.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    getJson(key) {
      const text = store.getText(key);
      return text === null ? undefined : parseJson(text);
    },
    setJson(key, value) {
      return store.setText(key, JSON.stringify(value));
    },
    remove(key) {
      try {
        get()?.removeItem(key);
      } catch {
        /* storage blocked: nothing to remove */
      }
    },
    keys(prefix) {
      try {
        const kv = get();
        if (!kv) return [];
        const out: string[] = [];
        for (let i = 0; i < kv.length; i++) {
          const k = kv.key(i);
          if (k !== null && k.startsWith(prefix)) out.push(k);
        }
        return out;
      } catch {
        return [];
      }
    },
  };
  return store;
}

/** The page's localStorage, safely. */
export const localStore: Store = createStore(() => (typeof localStorage === 'undefined' ? null : localStorage));

/** The page's sessionStorage (survives a reload, not a new tab), safely. */
export const sessionStore: Store = createStore(() => (typeof sessionStorage === 'undefined' ? null : sessionStorage));
