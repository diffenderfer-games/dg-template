/**
 * kit/ui: the `#ui` overlay root every kit screen, modal and toast lives in.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md
 *
 * Every kit screen is DOM over the canvas: that is what the hub's
 * autoNavigate, focus rings, the on-screen keyboard and screen readers work
 * with. `mountUi` is called once by `defineGame` (or a test).
 */
import { realClock, type Clock } from '../core/clock.ts';
import { KIT_CSS } from './css.ts';

/** The UI layer. */
export type UiRoot = {
  readonly root: HTMLElement;
  readonly clock: Clock;
  reducedMotion: boolean;
};

let current: UiRoot | null = null;

/**
 * Use `root` (default: `#ui`, created when missing) for kit UI, and add the kit's CSS once, FIRST in
 * `<head>`: the game's theme.css comes after it, so a plain `:root { --kit-bg: … }` or `.kit-btn { … }`
 * there wins every tie (docs/kit/ui.md § "Styling the kit's screens").
 */
export function mountUi(root?: HTMLElement, clock: Clock = realClock): UiRoot {
  const el = root ?? document.getElementById('ui') ?? createRoot();
  if (!document.getElementById('kit-css')) {
    const style = document.createElement('style');
    style.id = 'kit-css';
    style.textContent = KIT_CSS;
    document.head.prepend(style);
  }
  el.classList.add('kit-ui');
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  current = { root: el, clock, reducedMotion: reduced };
  return current;
}

function createRoot(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'ui';
  document.body.appendChild(el);
  return el;
}

/** The mounted UI layer (mounting the default one on first use). */
export function ui(): UiRoot {
  return current ?? mountUi();
}
