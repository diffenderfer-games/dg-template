/**
 * kit/ui: toasts, with optional action buttons (solitaire showToast).
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Toasts"
 */
import { button } from './controls.ts';
import { h } from './dom.ts';
import { ui } from './root.ts';

/** A toast action. */
export type ToastAction = { label: string; onClick: () => void; testid?: string };

/** Show a short message; it dismisses itself after `ms` (default 3 s, 8 s with actions) or on an action. */
export function toast(
  text: string,
  o: { ms?: number; kind?: 'info' | 'good' | 'warn'; actions?: ToastAction[] } = {},
): () => void {
  const { root, clock } = ui();
  let stack = root.querySelector<HTMLElement>('.kit-toasts');
  if (!stack) {
    stack = h('div.kit-toasts', { 'aria-live': 'polite' });
    root.appendChild(stack);
  }
  // The same message again replaces the one showing (no stack of repeats).
  for (const old of stack.querySelectorAll<HTMLElement>('.kit-toast')) if (old.dataset.text === text) old.remove();
  const el = h(
    'div.kit-toast',
    { 'data-kind': o.kind ?? 'info', 'data-testid': 'toast', 'data-text': text, role: 'status' },
    h('span.kit-toast-text', {}, text),
  );
  let cancel = (): void => undefined;
  const dismiss = (): void => {
    cancel();
    el.remove();
  };
  if (o.actions && o.actions.length > 0) {
    const row = h('div.kit-toast-actions');
    for (const a of o.actions) {
      row.appendChild(
        button(
          a.label,
          () => {
            dismiss();
            a.onClick();
          },
          { testid: a.testid },
        ),
      );
    }
    el.appendChild(row);
  }
  stack.appendChild(el);
  cancel = clock.after(o.ms ?? (o.actions ? 8000 : 3000), dismiss);
  return dismiss;
}
