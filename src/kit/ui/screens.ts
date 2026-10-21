/**
 * kit/ui: one screen at a time (title, play, pause, result, lobby…), with presence.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Screens"
 *
 * `show(name, build)` swaps the screen; the root gets `data-screen=<name>`
 * (CSS and the screenshot runner read it), and presence is reported for the
 * screen, coalesced (only when it changes; garbage `show()`).
 */
import type { PresenceInput } from '@diffenderfer-games/hub';
import { ui } from './root.ts';

/** A screen manager over the UI root. */
export class Screens {
  private name = '';
  private el: HTMLElement | null = null;
  private lastPresence: PresenceInput | null = null;
  private readonly setPresence: ((p: PresenceInput) => void) | null;

  constructor(setPresence: ((p: PresenceInput) => void) | null = null) {
    this.setPresence = setPresence;
  }

  /** The current screen's name. */
  get current(): string {
    return this.name;
  }

  /** The current screen's element. */
  get element(): HTMLElement | null {
    return this.el;
  }

  /** Show `name`, built by `build()`; report `presence` (default: menu, or playing for `play`). */
  show(name: string, build: () => HTMLElement, opts: { presence?: PresenceInput } = {}): HTMLElement {
    const root = ui().root;
    // Drawn again while it shows (a lobby on each change in the room): data-redraw skips entrance
    // animations, and focus on a part the new screen keeps (the chat box) stays put.
    const redraw = this.el !== null && this.name === name;
    const focused = document.activeElement;
    this.el?.remove();
    const el = build();
    el.classList.add('kit-screen');
    el.dataset.screen = name;
    if (redraw) el.dataset.redraw = 'true';
    root.appendChild(el);
    root.dataset.screen = name;
    this.name = name;
    this.el = el;
    const presence = opts.presence ?? { kind: name === 'play' ? 'playing' : 'menu' };
    if (this.setPresence && JSON.stringify(presence) !== JSON.stringify(this.lastPresence)) {
      this.lastPresence = presence;
      this.setPresence(presence);
    }
    if (redraw && focused instanceof HTMLElement && el.contains(focused)) focused.focus({ preventScroll: true });
    else el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return el;
  }
}
