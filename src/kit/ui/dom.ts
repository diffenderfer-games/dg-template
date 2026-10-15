/**
 * kit/ui: `h()`, a tiny DOM builder that only ever sets text.
 * Source: dg-template src/kit/ui/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/ui.md
 *
 * Children that are strings become text nodes (`textContent`), never HTML, so
 * player names and chat can't inject markup (multiplayer.md: render delivered
 * text only).
 */

/** A child: an element, text, or nothing. */
export type Child = Node | string | number | null | undefined | false;

/** Attributes: `class`, `data-*`, `aria-*`, any string attribute, `on*` handlers, and `style` as an object. */
export type Attrs = {
  class?: string;
  style?: Partial<Record<string, string>>;
  [name: `on${string}`]: ((e: Event) => void) | undefined;
  [name: string]: string | number | boolean | undefined | Partial<Record<string, string>> | ((e: Event) => void);
};

/**
 * Make an element: `h('button.big', { onclick }, 'Play')`. The tag may carry
 * classes after dots. Boolean attributes are set when true.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const [name = '', ...classes] = tag.split('.');
  if (!isTagOf<K>(name, tag)) throw new Error(`h(): bad tag "${tag}"`);
  const el = document.createElement(name);
  if (classes.length > 0) el.className = classes.join(' ');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class' && typeof value === 'string') el.className = [el.className, value].filter(Boolean).join(' ');
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) if (v !== undefined) el.style.setProperty(prop, v);
    } else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else if (typeof value === 'string' || typeof value === 'number') el.setAttribute(key, String(value));
  }
  append(el, ...kids);
  return el;
}

/** `name` is the tag part of `tag` (`K` or `K.class`), so it is a `K`. */
function isTagOf<K extends keyof HTMLElementTagNameMap>(name: string, tag: K | `${K}.${string}`): name is K {
  return name.length > 0 && (tag === name || tag.startsWith(`${name}.`));
}

/** Append children (text as text nodes). */
export function append(parent: Node, ...kids: Child[]): void {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    parent.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
}

/** Remove every child. */
export function clear(el: Element): void {
  el.replaceChildren();
}
