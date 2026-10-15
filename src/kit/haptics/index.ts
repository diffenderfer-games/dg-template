/**
 * kit/haptics: a short buzz on Android (vibrate) and iOS 18+ (the hidden switch trick), settings-gated and throttled.
 * Source: dg-template src/kit/haptics/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/haptics.md
 *
 * From bubblepop / helixdrop / bingo / popfour haptics.ts (identical apart
 * from the element id, here `idPrefix`). iOS Safari has no vibrate, but
 * clicking the label of an `<input type="checkbox" switch>` gives a tap.
 * Device check: scripts/kit/vibration-test.html (served by `npm run dev`).
 */

/** What the haptics touch (fakes in tests). */
export type HapticsEnv = { nav: { vibrate?: (pattern: number) => boolean }; doc: Document | null; idPrefix?: string };

const defaultEnv = (): HapticsEnv => ({
  nav: typeof navigator === 'undefined' ? {} : navigator,
  doc: typeof document === 'undefined' ? null : document,
});

/** Can this device buzz at all? */
export function hapticsSupported(env: HapticsEnv = defaultEnv()): boolean {
  return typeof env.nav.vibrate === 'function' || isIosSwitch(env);
}

function isIosSwitch(env: HapticsEnv): boolean {
  return env.doc !== null && typeof env.nav.vibrate !== 'function' && 'ontouchstart' in (env.doc.defaultView ?? {});
}

/** The hidden switch whose label click makes iOS tap. */
function iosLabel(doc: Document, prefix: string): HTMLLabelElement {
  const id = `${prefix}-haptic`;
  const existing = doc.getElementById(`${id}-label`);
  if (existing instanceof HTMLLabelElement) return existing;
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.setAttribute('switch', '');
  input.style.cssText = 'position:fixed;left:-100px;opacity:0;pointer-events:none';
  const label = doc.createElement('label');
  label.id = `${id}-label`;
  label.htmlFor = id;
  label.style.cssText = 'position:fixed;left:-100px;opacity:0;pointer-events:none';
  doc.body.append(input, label);
  return label;
}

/** One buzz now: a tick (4 ms), or a strong one (12 ms; two taps on iOS). */
export function haptic(strong = false, env: HapticsEnv = defaultEnv()): void {
  try {
    if (typeof env.nav.vibrate === 'function') {
      env.nav.vibrate(strong ? 12 : 4);
      return;
    }
    if (env.doc && isIosSwitch(env)) {
      const label = iosLabel(env.doc, env.idPrefix ?? 'kit');
      label.click();
      if (strong) label.click();
    }
  } catch {
    /* some browsers throw without a gesture: a missed buzz is fine */
  }
}

/** A settings-gated, throttled buzz for the game (`ctx.haptic`). */
export function makeBuzz(o: {
  enabled(): boolean;
  now(): number;
  minGapMs?: number;
  fire?: (strong: boolean) => void;
}): (strong?: boolean) => void {
  let last = -Infinity;
  const fire = o.fire ?? ((s: boolean) => haptic(s));
  return (strong = false) => {
    if (!o.enabled()) return;
    const t = o.now();
    if (t - last < (o.minGapMs ?? 40)) return;
    last = t;
    fire(strong);
  };
}
