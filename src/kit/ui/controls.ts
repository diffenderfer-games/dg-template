/**
 * kit/ui: buttons, segmented pickers, toggle rows and sliders (gamepad-navigable).
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md § "Controls"
 *
 * Every control gets `data-nav` (the hub's autoNavigate finds it) and a
 * `data-testid` (scripts and suites press it by name).
 */
import { bindAction } from '../input/glyphs.ts';
import { h } from './dom.ts';

/** Button options. */
export type ButtonOpts = {
  cls?: string;
  sub?: string;
  testid?: string;
  icon?: string;
  disabled?: boolean;
  /** The action it answers to, with its prompt chip: `'confirm'`, `'back'`, `'alt'`… (kit/input/glyphs.ts). */
  action?: string;
};

/** A navigable button: `button('Play', start, { testid: 'play' })`. */
export function button(label: string, onClick: () => void, o: ButtonOpts = {}): HTMLButtonElement {
  const b = h(
    'button.kit-btn',
    {
      type: 'button',
      class: o.cls,
      'data-nav': true,
      'data-testid': o.testid ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      disabled: o.disabled === true,
      onclick: () => onClick(),
    },
    o.icon === undefined ? null : h('span.kit-btn-icon', { 'aria-hidden': 'true' }, o.icon),
    h('span.kit-btn-label', {}, label),
    o.sub === undefined ? null : h('span.kit-btn-sub', {}, o.sub),
  );
  return o.action === undefined ? b : bindAction(b, o.action);
}

/** A row of mutually exclusive choices (garbage `seg`). */
export function segmented<T extends string | number>(
  items: readonly { value: T; label: string }[],
  value: T,
  onPick: (v: T) => void,
  testid = 'segmented',
): HTMLElement {
  const row = h('div.kit-seg', { role: 'radiogroup', 'data-testid': testid });
  const render = (current: T): void => {
    row.replaceChildren(
      ...items.map((it) =>
        h(
          'button.kit-seg-item',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': it.value === current ? 'true' : 'false',
            'data-nav': true,
            'data-testid': `${testid}-${it.value}`,
            onclick: () => {
              onPick(it.value);
              render(it.value);
            },
          },
          it.label,
        ),
      ),
    );
  };
  render(value);
  return row;
}

/** A labelled on/off switch (garbage `optRow`, sliderush aria-pressed). */
export function toggleRow(label: string, on: boolean, onChange: (on: boolean) => void, testid?: string): HTMLElement {
  let state = on;
  const sw = h('button.kit-toggle', {
    type: 'button',
    role: 'switch',
    'aria-checked': state ? 'true' : 'false',
    'aria-label': label,
    'data-nav': true,
    'data-testid': testid ?? `toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    onclick: () => {
      state = !state;
      sw.setAttribute('aria-checked', state ? 'true' : 'false');
      onChange(state);
    },
  });
  return h('div.kit-row', {}, h('span.kit-row-label', {}, label), sw);
}

/** A labelled 0..1 slider. */
export function sliderRow(label: string, value: number, onChange: (v: number) => void, testid?: string): HTMLElement {
  const input = h('input.kit-slider', {
    type: 'range',
    min: 0,
    max: 100,
    value: Math.round(value * 100),
    'aria-label': label,
    'data-nav': true,
    'data-testid': testid ?? `slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    oninput: () => onChange(Number(input.value) / 100),
  });
  return h('div.kit-row', {}, h('span.kit-row-label', {}, label), input);
}
