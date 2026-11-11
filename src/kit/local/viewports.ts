/**
 * kit/local: split-screen views for 1–4 local players, and a DOM layer over each.
 * Source: dg-template src/kit/local/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/local.md § "Split screen"
 *
 * Two players sit side by side on a wide screen and stacked on a tall one.
 * Three and four play in a 2×2 grid; with three, the fourth cell is the
 * standings panel. Rects are CSS px from the top left; `glViewport` turns one
 * into WebGL's bottom-left pixels for `setViewport`/`setScissor`.
 */
import { h } from '../ui/dom.ts';

/** A rectangle in CSS px from the top left. */
export type ViewRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** The split for some players. */
export type ViewLayout = {
  /** One per player, in seat order. */
  readonly views: readonly ViewRect[];
  /** The empty cell with three players (the standings panel), else null. */
  readonly standings: ViewRect | null;
};

/** The gap between views, CSS px (the dividers). */
export const VIEW_GAP = 4;

/** Split `width` × `height` for `players` (1..4) with `gap` px between views. */
export function viewLayout(players: number, width: number, height: number, gap = VIEW_GAP): ViewLayout {
  const n = Math.max(1, Math.min(4, Math.floor(players)));
  if (n === 1) return { views: [{ x: 0, y: 0, width, height }], standings: null };
  const halfW = (width - gap) / 2;
  const halfH = (height - gap) / 2;
  if (n === 2) {
    const sideBySide = width >= height;
    const views: ViewRect[] = sideBySide
      ? [
          { x: 0, y: 0, width: halfW, height },
          { x: halfW + gap, y: 0, width: halfW, height },
        ]
      : [
          { x: 0, y: 0, width, height: halfH },
          { x: 0, y: halfH + gap, width, height: halfH },
        ];
    return { views, standings: null };
  }
  const cells: ViewRect[] = [
    { x: 0, y: 0, width: halfW, height: halfH },
    { x: halfW + gap, y: 0, width: halfW, height: halfH },
    { x: 0, y: halfH + gap, width: halfW, height: halfH },
    { x: halfW + gap, y: halfH + gap, width: halfW, height: halfH },
  ];
  return { views: cells.slice(0, n), standings: n === 3 ? (cells[3] ?? null) : null };
}

/** A rect as WebGL pixels (bottom-left origin) on a canvas `canvasHeight` CSS px tall, at `pixelRatio`. */
export function glViewport(
  rect: ViewRect,
  canvasHeight: number,
  pixelRatio = 1,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(rect.x * pixelRatio),
    y: Math.round((canvasHeight - rect.y - rect.height) * pixelRatio),
    width: Math.round(rect.width * pixelRatio),
    height: Math.round(rect.height * pixelRatio),
  };
}

/** The DOM over the views: one layer per player (its HUD goes inside), the standings cell, the dividers. */
export type ViewLayers = {
  readonly root: HTMLElement;
  /** Player `seat`'s layer (null past the count). */
  view(seat: number): HTMLElement | null;
  /** The standings cell (three players), or null. */
  readonly standings: HTMLElement | null;
  /** Place everything for a new size. */
  layout(width: number, height: number): ViewLayout;
  remove(): void;
};

/** What a view layer needs to know of its player. */
export type ViewPlayer = {
  readonly color: string;
  /** Their device, so the view's button chips show its glyphs (default: the page's). */
  readonly device?: 'pad' | 'keyboard';
  readonly padStyle?: 'xbox' | 'ps' | null;
};

/**
 * Mount the view layers into `parent` (the HUD's element, or the kit's UI root). Each layer is
 * `position: absolute` at its rect, with `--view-w` / `--view-h` and `data-seat`, coloured
 * `--seat-color` (the divider edge), so a game's HUD CSS sizes from its view, not the window. A
 * player's `device` sets the layer's `data-prompts` / `data-pad-style`, so the button chips in
 * their view show their own controller's (or the keyboard's) glyphs, whoever pressed last.
 */
export function mountViewLayers(
  parent: HTMLElement,
  players: readonly ViewPlayer[],
  size: { width: number; height: number },
): ViewLayers {
  const root = h('div.kit-views', { 'data-testid': 'local-views', 'data-players': players.length });
  const layers = players.map((player, seat) =>
    h('div.kit-view', {
      'data-seat': seat,
      'data-testid': `local-view-${seat}`,
      'data-prompts': player.device === undefined ? undefined : player.device === 'pad' ? 'pad' : 'keys',
      'data-pad-style': player.device === 'pad' ? (player.padStyle ?? 'xbox') : undefined,
      style: { '--seat-color': player.color },
    }),
  );
  const standings =
    players.length === 3 ? h('div.kit-view.kit-view-standings', { 'data-testid': 'local-standings' }) : null;
  root.append(...layers, ...(standings === null ? [] : [standings]));
  parent.appendChild(root);
  const place = (el: HTMLElement, rect: ViewRect): void => {
    Object.assign(el.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    el.style.setProperty('--view-w', `${rect.width}px`);
    el.style.setProperty('--view-h', `${rect.height}px`);
  };
  const layout = (width: number, height: number): ViewLayout => {
    const split = viewLayout(players.length, width, height);
    split.views.forEach((rect, seat) => {
      const el = layers[seat];
      if (el !== undefined) place(el, rect);
    });
    if (standings !== null && split.standings !== null) place(standings, split.standings);
    return split;
  };
  layout(size.width, size.height);
  return {
    root,
    view: (seat) => layers[seat] ?? null,
    standings,
    layout,
    remove: () => root.remove(),
  };
}
