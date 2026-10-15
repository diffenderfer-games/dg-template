/**
 * kit/ui: juice (banners, count-ups, confetti, staggered entrances), off with reduced motion.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Juice"
 *
 * From phase10/uno juice.ts and bubblepop ui.ts. All CSS-driven DOM, so it
 * works over any renderer; `ui().reducedMotion` (the setting, or the
 * system's) turns the motion off and keeps the result.
 */
import { h } from './dom.ts';
import { ui } from './root.ts';

/** A big centred word that pops in and fades ("Level 3!", "You won!"). */
export function banner(text: string, ms = 1400): void {
  const { root, clock, reducedMotion } = ui();
  const el = h('div.kit-banner', { 'data-testid': 'banner', 'data-still': reducedMotion ? 'true' : undefined }, text);
  root.appendChild(el);
  clock.after(ms, () => el.remove());
}

/** Count a number up in `el` from `from` to `to` over `ms` (instant with reduced motion). */
export function countUp(el: HTMLElement, from: number, to: number, ms = 600): void {
  const { clock, reducedMotion } = ui();
  if (reducedMotion || ms <= 0) {
    el.textContent = String(to);
    return;
  }
  const start = clock.now();
  const tick = (): void => {
    const t = Math.min(1, (clock.now() - start) / ms);
    el.textContent = String(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
    if (t < 1) clock.frame(tick);
  };
  tick();
}

/** Confetti pieces falling over the UI (CSS animation; none with reduced motion). */
export function confetti(
  count = 60,
  colors: readonly string[] = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b'],
): void {
  const { root, clock, reducedMotion } = ui();
  if (reducedMotion) return;
  const layer = h('div.kit-confetti', { 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    // Cosmetic only: a spread from the index, no RNG needed.
    const x = (i * 37) % 100;
    const delay = (i * 53) % 900;
    const color = colors[i % colors.length] ?? '#fff';
    layer.appendChild(h('i', { style: { left: `${x}%`, 'animation-delay': `${delay}ms`, background: color } }));
  }
  root.appendChild(layer);
  clock.after(2600, () => layer.remove());
}

/** Fade children in one after another (a menu appearing). */
export function stagger(parent: HTMLElement, stepMs = 50): void {
  if (ui().reducedMotion) return;
  [...parent.children].forEach((child, i) => {
    if (child instanceof HTMLElement) {
      child.style.setProperty('animation-delay', `${i * stepMs}ms`);
      child.classList.add('kit-in');
    }
  });
}
