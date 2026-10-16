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
  continueSaved: (id: string) => void;
  quickMatch: () => void;
  daily: () => void;
  race: () => void;
  raceBrowse: () => void;
  online: () => void;
  /** Play online: an online game the hub runs (kit/turns), the default way to play online. */
  turns: () => void;
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
  /** Continue rows: every saved game of this game (hub.saved: the saved game, days in progress). */
  continueRows: readonly { id: string; label: string }[];
  /** Quick match (world W2): shown when the hub has it. */
  quickMatch?: boolean;
  daily: boolean;
  dailyDone: boolean;
  race: boolean;
  online: boolean;
  /** The game plays online games the hub runs (`game.turns` and a `turns` hook). */
  turns?: boolean;
  /** The hub's social runtime failed to load (hub:rt-failed): online play is off for now. */
  onlineDown?: boolean;
};

/** The title screen. */
export function titleScreen(o: TitleOptions, a: ScreenActions): HTMLElement {
  const menu = h('div.kit-menu', {});
  o.continueRows.forEach((row, i) =>
    menu.appendChild(
      button(t('continue'), () => a.continueSaved(row.id), {
        cls: i === 0 ? 'kit-primary' : undefined,
        sub: row.label,
        testid: i === 0 ? 'continue' : `continue-${row.id}`,
      }),
    ),
  );
  menu.appendChild(
    button(t('play'), a.play, { cls: o.continueRows.length === 0 ? 'kit-primary' : undefined, testid: 'play' }),
  );
  if (o.daily)
    menu.appendChild(button(t('daily'), a.daily, { testid: 'daily', sub: o.dailyDone ? t('dailyDone') : undefined }));
  if (o.race) {
    menu.appendChild(button(t('race'), a.race, { testid: 'race' }));
    menu.appendChild(button(t('raceBrowse'), a.raceBrowse, { testid: 'race-browse' }));
  }
  // An online game the hub runs is the default way to play online ("Play online"); a live room beside it is "Play now".
  if (o.turns === true) {
    const sub = o.onlineDown === true ? t('onlineNeedsConnection') : t('turnsNewSub');
    menu.appendChild(button(t('turnsNew'), a.turns, { testid: 'turns-new', disabled: o.onlineDown === true, sub }));
  }
  if (o.online) {
    const sub = o.onlineDown === true ? t('onlineNeedsConnection') : undefined;
    const label = o.turns === true ? t('playNow') : t('online');
    menu.appendChild(button(label, a.online, { testid: 'online', disabled: o.onlineDown === true, sub }));
    if (o.quickMatch === true) menu.appendChild(button(t('quickMatch'), a.quickMatch, { testid: 'quick-match' }));
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
