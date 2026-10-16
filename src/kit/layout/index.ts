/**
 * kit/layout: resize (rotation-safe), safe areas, letterboxing, the play region, text fit.
 * Source: dg-template src/kit/layout/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/layout.md
 *
 * - `onResize` fires on resize, rotation (twice: the viewport settles late on
 *   phones; tetrablox relayout), and visualViewport changes, debounced.
 * - `layoutRegion` is the rectangle gameplay may use: inside the safe area,
 *   below the race HUD and the top HUD, above the bottom HUD (solitaire region()).
 * - Every size is the window's own (`innerWidth`/`innerHeight`, never `screen`):
 *   in the world's box that is the box, and the box resizing fires `onResize`.
 * - `goFullscreen` / `lockPointer` do nothing inside a frame (the world's box
 *   owns the window there: hub.md "Playing over the world").
 */
import type { Clock } from '../core/clock.ts';
import { realClock } from '../core/clock.ts';
import { inFrame } from '../core/env.ts';

/** Call `cb(width, height)` when the viewport size settles; returns the unsubscribe. */
export function onResize(
  cb: (w: number, h: number) => void,
  o: { debounceMs?: number; clock?: Clock; win?: Window } = {},
): () => void {
  const win = o.win ?? window;
  const clock = o.clock ?? realClock;
  let cancel: () => void = () => undefined;
  const fire = (): void => cb(win.innerWidth, win.innerHeight);
  const schedule = (): void => {
    cancel();
    cancel = clock.after(o.debounceMs ?? 60, fire);
  };
  // Rotation: the size is wrong for a moment on phones, so measure again once it settles.
  let cancelSettle: () => void = () => undefined;
  const onRotate = (): void => {
    schedule();
    cancelSettle();
    cancelSettle = clock.after(350, fire);
  };
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', onRotate);
  win.visualViewport?.addEventListener('resize', schedule);
  return () => {
    cancel();
    cancelSettle();
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', onRotate);
    win.visualViewport?.removeEventListener('resize', schedule);
  };
}

/** Insets in CSS px. */
export type Insets = { top: number; right: number; bottom: number; left: number };

/** The safe-area insets (notch, home bar), read from `env()` with a probe element (bubblepop). */
export function safeArea(doc: Document = document): Insets {
  const probe = doc.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  doc.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string): number => Number.parseFloat(v) || 0;
  const out = {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
  probe.remove();
  return out;
}

/** Fit a `w`×`h` design into a `vw`×`vh` viewport, centred (iansaur fit, downfall initApp). */
export function letterbox(vw: number, vh: number, w: number, h: number): { scale: number; x: number; y: number } {
  const scale = Math.min(vw / w, vh / h);
  return { scale, x: (vw - w * scale) / 2, y: (vh - h * scale) / 2 };
}

/** A rectangle. */
export type Region = { x: number; y: number; width: number; height: number };

/** The race HUD's height at the top and bottom (`--hub-race-hud-*`, multiplayer.md §14.5). */
export function raceHud(doc: Document = document): { top: number; bottom: number } {
  const cs = getComputedStyle(doc.documentElement);
  const px = (name: string): number => Number.parseFloat(cs.getPropertyValue(name)) || 0;
  return { top: px('--hub-race-hud-top'), bottom: px('--hub-race-hud-bottom') };
}

/**
 * The rectangle gameplay may use: the viewport minus the safe area, the race
 * HUD, the given HUD bands and (optionally) room for the hub menu button.
 */
export function layoutRegion(o: {
  width: number;
  height: number;
  safe?: Insets;
  race?: { top: number; bottom: number };
  top?: readonly Element[];
  bottom?: readonly Element[];
  menuButton?: number;
}): Region {
  const safe = o.safe ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const race = o.race ?? { top: 0, bottom: 0 };
  const topBands = Math.max(0, ...(o.top ?? []).map((el) => el.getBoundingClientRect().bottom));
  const bottomBands = Math.max(0, ...(o.bottom ?? []).map((el) => o.height - el.getBoundingClientRect().top));
  const top = Math.max(safe.top + race.top, topBands, o.menuButton ?? 0);
  const bottom = Math.max(safe.bottom + race.bottom, bottomBands);
  return {
    x: safe.left,
    y: top,
    width: Math.max(0, o.width - safe.left - safe.right),
    height: Math.max(0, o.height - top - bottom),
  };
}

/** Shrink an element's font until its text fits its width (bfme fit.ts); returns a refit function. */
export function fitText(el: HTMLElement, o: { min?: number; max?: number } = {}): () => void {
  const refit = (): void => {
    let size = o.max ?? (Number.parseFloat(getComputedStyle(el).fontSize) || 16);
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > (o.min ?? 10)) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  };
  refit();
  return refit;
}

/** Portrait viewport? */
export const isPortrait = (w: number = innerWidth, h: number = innerHeight): boolean => h > w;

/** A phone-sized viewport (short side under 600 CSS px)? In the world's box: a small box. */
export const isPhone = (w: number = innerWidth, h: number = innerHeight): boolean => Math.min(w, h) < 600;

/** Ask for fullscreen, never inside a frame (the box has its own "fill the window"). True when granted. */
export async function goFullscreen(el: Element = document.documentElement, win?: Window): Promise<boolean> {
  if (inFrame(win) || typeof el.requestFullscreen !== 'function') return false;
  try {
    await el.requestFullscreen();
    return true;
  } catch {
    return false; // no gesture, or the browser said no
  }
}

/** Lock the pointer (mouse-look), never inside a frame (the box doesn't allow it). True when asked. */
export async function lockPointer(el: Element, win?: Window): Promise<boolean> {
  if (inFrame(win) || typeof el.requestPointerLock !== 'function') return false;
  try {
    await el.requestPointerLock();
    return true;
  } catch {
    return false;
  }
}

/** Keep `<meta name="theme-color">` at `color` (helixdrop applyThemeColor). Returns the restore. */
export function keepThemeColor(color: string, doc: Document = document): () => void {
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const before = meta?.content ?? null;
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.appendChild(meta);
  }
  const m = meta;
  m.content = color;
  const obs = new MutationObserver(() => {
    if (m.content !== color) m.content = color;
  });
  obs.observe(m, { attributes: true, attributeFilter: ['content'] });
  return () => {
    obs.disconnect();
    if (before !== null) m.content = before;
  };
}
