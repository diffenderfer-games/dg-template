/**
 * kit/core: the hub's window events, typed and parsed.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 *
 * The hub menu and runtime are other bundles, so their `CustomEvent` details
 * are untrusted: each event has a parser, and listeners get typed values.
 */
import { boolField, field, numField, strField } from './json.ts';

/** A signed-in user as `hub:auth` reports it. */
export type AuthUser = { id: number; guest: boolean };

/** Every hub window event the kit reads, with its parsed detail. */
export type HubWindowEvents = {
  /** Log in or out from the menu (hub.md "Saves and stats"). */
  'hub:auth': { user: AuthUser | null };
  /** The menu's "Reset game": wipe local state before the hub reloads the page. */
  'hub:reset': { slug: string | null };
  'hub:daily-started': { day: string; seed: number };
  'hub:daily-complete': { day: string };
  'hub:daily-queued': { day: string };
  'hub:daily-error': { day: string; error: string };
  /** Where the race HUD sits (multiplayer.md §14.5). */
  'hub:race-hud': { visible: boolean; top: number; bottom: number; left: number; right: number };
  'hub:menu-visibility': { visible: boolean };
  'hub:online': Record<string, never>;
  'hub:offline': Record<string, never>;
  'hub:sync': { conflicts: number };
  'hub:rt-ready': Record<string, never>;
  'hub:rt-failed': Record<string, never>;
  'hub:overlay-open': { reason: string; canPause: boolean };
  'hub:overlay-close': { reason: string; canPause: boolean };
};

/** A hub window event name. */
export type HubWindowEvent = keyof HubWindowEvents;

const EMPTY: Record<string, never> = {};

function parseUser(x: unknown): AuthUser | null {
  const id = numField(x, 'id', -1);
  return id < 0 ? null : { id, guest: boolField(x, 'guest') };
}

const PARSERS: { [K in HubWindowEvent]: (detail: unknown) => HubWindowEvents[K] } = {
  'hub:auth': (d) => ({ user: parseUser(field(d, 'user')) }),
  'hub:reset': (d) => ({ slug: strField(d, 'slug') || null }),
  'hub:daily-started': (d) => ({ day: strField(d, 'day'), seed: numField(d, 'seed') }),
  'hub:daily-complete': (d) => ({ day: strField(d, 'day') }),
  'hub:daily-queued': (d) => ({ day: strField(d, 'day') }),
  'hub:daily-error': (d) => ({ day: strField(d, 'day'), error: strField(d, 'error') }),
  'hub:race-hud': (d) => ({
    visible: boolField(d, 'visible'),
    top: numField(d, 'top'),
    bottom: numField(d, 'bottom'),
    left: numField(d, 'left'),
    right: numField(d, 'right'),
  }),
  'hub:menu-visibility': (d) => ({ visible: boolField(d, 'visible', true) }),
  'hub:online': () => EMPTY,
  'hub:offline': () => EMPTY,
  'hub:sync': (d) => {
    const conflicts = field(d, 'conflicts');
    return { conflicts: Array.isArray(conflicts) ? conflicts.length : 0 };
  },
  'hub:rt-ready': () => EMPTY,
  'hub:rt-failed': () => EMPTY,
  'hub:overlay-open': (d) => ({ reason: strField(d, 'reason'), canPause: boolField(d, 'canPause', true) }),
  'hub:overlay-close': (d) => ({ reason: strField(d, 'reason'), canPause: boolField(d, 'canPause', true) }),
};

/** The detail of a window event (untrusted). */
function detailOf(e: Event): unknown {
  if (!(e instanceof CustomEvent)) return undefined;
  const detail: unknown = e.detail;
  return detail;
}

/** Listen to a hub window event; returns the unsubscribe. */
export function onWindow<K extends HubWindowEvent>(
  name: K,
  cb: (detail: HubWindowEvents[K]) => void,
  target: EventTarget = window,
): () => void {
  const listener = (e: Event): void => cb(PARSERS[name](detailOf(e)));
  target.addEventListener(name, listener);
  return () => target.removeEventListener(name, listener);
}

/** Fire a hub window event (the FakeHub and tests use it). */
export function emitWindow<K extends HubWindowEvent>(
  name: K,
  detail: HubWindowEvents[K],
  target: EventTarget = window,
): void {
  target.dispatchEvent(new CustomEvent(name, { detail }));
}
