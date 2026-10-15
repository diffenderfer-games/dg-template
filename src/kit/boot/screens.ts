/**
 * kit/boot: the standard screens (title, loading, play, pause, result) built from kit/ui.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md § "Screens"
 *
 * The game skins them with CSS variables and decorates them through its
 * `screens` hooks (src/game/screens/*). Every button has a `data-testid`.
 */
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { openModal } from '../ui/modal.ts';
import { stagger } from '../ui/juice.ts';

/** What the screens' buttons do. */
export type ScreenActions = {
  play: () => void;
  continueSaved: () => void;
  daily: () => void;
  race: () => void;
  raceBrowse: () => void;
  online: () => void;
  settings: () => void;
  howTo: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  quit: () => void;
};

/** Which title buttons to show. */
export type TitleOptions = {
  title: string;
  tagline?: string;
  continueLabel: string | null;
  daily: boolean;
  dailyDone: boolean;
  race: boolean;
  online: boolean;
  /** The hub's social runtime failed to load (hub:rt-failed): online play is off for now. */
  onlineDown?: boolean;
};

/** The title screen. */
export function titleScreen(o: TitleOptions, a: ScreenActions): HTMLElement {
  const menu = h('div.kit-menu', {});
  if (o.continueLabel !== null) {
    menu.appendChild(
      button(t('continue'), a.continueSaved, { cls: 'kit-primary', sub: o.continueLabel, testid: 'continue' }),
    );
  }
  menu.appendChild(
    button(t('play'), a.play, { cls: o.continueLabel === null ? 'kit-primary' : undefined, testid: 'play' }),
  );
  if (o.daily)
    menu.appendChild(button(t('daily'), a.daily, { testid: 'daily', sub: o.dailyDone ? t('dailyDone') : undefined }));
  if (o.race) {
    menu.appendChild(button(t('race'), a.race, { testid: 'race' }));
    menu.appendChild(button(t('raceBrowse'), a.raceBrowse, { testid: 'race-browse' }));
  }
  if (o.online) {
    const sub = o.onlineDown === true ? t('onlineNeedsConnection') : undefined;
    menu.appendChild(button(t('online'), a.online, { testid: 'online', disabled: o.onlineDown === true, sub }));
  }
  menu.appendChild(button(t('settings'), a.settings, { testid: 'settings' }));
  menu.appendChild(button(t('howTo'), a.howTo, { testid: 'howto' }));
  stagger(menu);
  return h(
    'div.kit-title-screen.kit-dim',
    {},
    h('h1.kit-title', { 'data-testid': 'game-title' }, o.title),
    o.tagline === undefined ? null : h('p.kit-tagline', {}, o.tagline),
    menu,
  );
}

/** Shown while the game mounts, or while a deep link (`?daily=`) is answered. */
export function loadingScreen(): HTMLElement {
  return h('div.kit-loading', { 'aria-busy': 'true' }, h('p.kit-tagline', {}, t('loading')));
}

/** The play screen: the HUD row and a pause button (the hub menu sits in the other corner). */
export function playScreen(a: ScreenActions): { el: HTMLElement; hud: HTMLElement } {
  const hud = h('div.kit-hud', { 'data-testid': 'hud' });
  const pause = button('II', a.pause, { cls: 'kit-pause-btn', testid: 'pause' });
  pause.setAttribute('aria-label', t('paused'));
  const corner = h(
    'div.kit-corner',
    { style: { top: 'var(--kit-top)', left: 'max(env(safe-area-inset-left), 10px)' } },
    pause,
  );
  return { el: h('div', {}, corner, hud), hud };
}

/** The pause screen (in a race the pause button asks "Leave race?" instead; see the session). */
export function pauseScreen(a: ScreenActions): HTMLElement {
  const menu = h(
    'div.kit-menu',
    {},
    button(t('resume'), a.resume, { cls: 'kit-primary', testid: 'resume' }),
    button(t('restart'), a.restart, { testid: 'restart' }),
    button(t('settings'), a.settings, { testid: 'settings' }),
    button(t('quit'), a.quit, { testid: 'quit' }),
  );
  return h('div.kit-dim', {}, h('h2.kit-title', {}, t('paused')), menu);
}

/** The result screen. */
export function resultScreen(won: boolean, a: ScreenActions, opts: { again: boolean }): HTMLElement {
  const menu = h('div.kit-menu', {});
  if (opts.again) menu.appendChild(button(t('playAgain'), a.restart, { cls: 'kit-primary', testid: 'play-again' }));
  menu.appendChild(button(t('quit'), a.quit, { testid: 'quit' }));
  return h(
    'div.kit-dim',
    {},
    h('h2.kit-title', { 'data-testid': 'result-title' }, won ? t('won') : t('lost')),
    h('div.kit-result-body'),
    menu,
  );
}

/** How to play, as a modal. */
export function howToModal(lines: readonly string[]): void {
  openModal({
    title: t('howTo'),
    body: h('div', {}, ...lines.map((l) => h('p', {}, l))),
    testid: 'howto',
    buttons: [{ label: t('ok'), primary: true, testid: 'howto-ok' }],
  });
}
