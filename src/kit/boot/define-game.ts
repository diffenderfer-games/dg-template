/**
 * kit/boot: `defineGame(hub, game)`, the one entry point.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md
 *
 * Synchronously, before any await (the launch and daily handlers must be
 * registered at once): strings, UI root, profile and Continue, autoPause,
 * the daily, the race and online handlers, window listeners, controls and
 * menu navigation. Then the async boot: mount the game, wait (briefly) for the
 * profile, route once, install `window.__game`, and set `body[data-ready]`.
 */
import { createActivity } from '../core/activity.ts';
import { dayKey, realClock, type Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import type { JsonObject } from '../core/json.ts';
import { localStore, sessionStore, type Store } from '../core/store.ts';
import { setKitStrings, t } from '../core/strings.ts';
import { installDaily } from '../daily/index.ts';
import { controlHints, defineControls, installMenuNav, installPrompts, setPromptBindings } from '../input/index.ts';
import { onWindow } from '../core/events.ts';
import { isEmbedded } from '../core/env.ts';
import { createKitAudio } from '../audio/kit-audio.ts';
import { hapticsSupported, makeBuzz } from '../haptics/index.ts';
import { installLaunches } from '../online/launch.ts';
import { installPause } from '../pause/index.ts';
import { installRace } from '../race/index.ts';
import { createResume } from '../resume/index.ts';
import { createSaved } from '../saved/index.ts';
import { createProfile } from '../save/profile.ts';
import { createSettings } from '../save/settings.ts';
import { kitSettingsDefaults, settingsSheet, type KitSettings } from '../settings-ui/index.ts';
import { mountUi } from '../ui/root.ts';
import { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import { buildContext } from './context.ts';
import { MANIFEST } from '../core/manifest.ts';
import { OnlineFlow } from './online-flow.ts';
import { TurnsFlow } from './turns-flow.ts';
import { routeOnce } from './router.ts';
import { howToModal } from './screens.ts';
import { Session } from './session.ts';
import { installGameHook } from './test-hook.ts';
import type { GameDefinition, NavState, TurnBoard } from './types.ts';
import { pageBackGuard } from '../ui/back-guard.ts';
import type { PadButtons } from '@diffenderfer-games/hub';

/** Where things go (tests pass fakes; the game passes nothing). */
export type DefineGameOptions = {
  clock?: Clock;
  store?: Store;
  /** Where hub window events arrive (default `window`). */
  events?: EventTarget;
  /** The renderer's element (default `#app`, created when missing). */
  stage?: HTMLElement;
  /** The kit UI's element (default `#ui`). */
  uiRoot?: HTMLElement;
  /** The page's query string (default `location.search`). */
  search?: string;
  /** Install test drivers on `window.__game` (default: dev, localhost or `__HUB_TEST__`). */
  drivers?: boolean;
};

/** What `defineGame` returns (tests drive it; the game ignores it). */
export type GameHandle<P extends JsonObject, R extends JsonObject> = {
  readonly session: Session<P, R>;
  /** Resolves when the boot has routed (title, a daily, Continue…). */
  readonly booted: Promise<void>;
  /** Stop the loop and remove every listener (tests boot many games on one page). */
  dispose(): void;
};

/** Is the player typing in a field (an Esc there is the field's)? */
function isTyping(): boolean {
  const el = typeof document === 'undefined' ? null : document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** Wire the game to the hub. Call once, at load, synchronously (src/main.ts). */
export function defineGame<P extends JsonObject, R extends JsonObject>(
  hub: HubLike,
  game: GameDefinition<P, R>,
  o: DefineGameOptions = {},
): GameHandle<P, R> {
  const clock = o.clock ?? realClock;
  const store = o.store ?? localStore;
  const events = o.events ?? window;
  const search = o.search ?? location.search;
  // The game's id: every key the kit stores. The hub's slug is the id the host injects; package.json's
  // `game.id` covers a renamed game where the hub has only the address to go on (its public slug).
  const slug = game.slug ?? MANIFEST.id ?? hub.slug ?? location.pathname.split('/').filter(Boolean)[0] ?? 'game';
  if (game.strings) setKitStrings(game.strings);
  const ui = mountUi(o.uiRoot, clock);
  const activity = createActivity();
  const screens = new Screens((p) => hub.presence.set(p));
  const settings = createSettings<KitSettings>(
    { key: `${slug}:settings`, version: 1, defaults: kitSettingsDefaults },
    store,
  );
  ui.reducedMotion = settings.data.reducedMotion;
  const profile = createProfile(hub, game.profile, { slug, clock, activity, store, events });
  const resume = createResume(hub, game.run, { activity, clock });
  const today = (): string => dayKey(clock.now());

  // Online games the hub runs: the game draws the board (`turns`) and declares `game.turns` (package.json).
  const turnsOn = game.turns !== undefined && MANIFEST.turns;
  let turns: TurnsFlow | null = null;
  const saved = createSaved(
    hub,
    {
      continueRun: () => void session.continueSaved(),
      resumeDaily: (id) => void hub.daily.resume(id),
      // Online games the hub runs open on the kit's screen when the game plays them (else the hub reloads with ?hub_open=).
      ...(turnsOn ? { openTurns: (id: string) => void turns?.open(id) } : {}),
    },
    () => void session.refreshContinue(),
  );

  const session: Session<P, R> = new Session<P, R>({
    saved,
    game,
    hub,
    clock,
    activity,
    resume,
    screens,
    today,
    actions: {
      settings: () =>
        settingsSheet({ settings, haptics: hapticsSupported(), rows: () => game.settingsRows?.(ctx) ?? [] }),
      howTo: () => howToModal(game.copy.howTo ?? []),
    },
  });

  // 1. pause on hub UI, the page hiding, or the player (once, at boot)
  const pause = installPause(
    hub,
    {
      canPause: () => session.canPause(),
      show: () => session.showPause(),
      hide: () => session.hidePause(),
      resumeOnClose: game.resumeOnClose === true,
    },
    { clock },
  );
  // 2. online: launches and join info registered now (the hub's 8 s rule); they wait for mount
  const roomGame =
    game.live !== undefined ? { live: game.live } : game.online !== undefined ? { online: game.online } : null;
  const online =
    roomGame === null
      ? null
      : new OnlineFlow(hub, roomGame, clock, screens, {
          enter: () => session.enterOnline(),
          showPlay: () => session.showPlay(),
          showResult: (won) => session.showResult(won, false),
          toTitle: () => session.toTitle(),
          guard: () => session.guardOnline(),
          get screen() {
            return session.screen;
          },
        });
  const launches =
    online === null
      ? null
      : installLaunches(hub, {
          host: (l) => online.hostRoom(l),
          join: (room, _l, spectate) => online.joinRoom(room, spectate),
          currentRoom: () => online.currentRoom(),
        });
  // 2b. online games the hub runs (opened from Your games, a link or the title)
  if (turnsOn && game.turns !== undefined) {
    const hooks = game.turns;
    turns = new TurnsFlow({
      hub,
      hooks: {
        ...(hooks.create === undefined ? {} : { create: hooks.create }),
        ...(hooks.testMove === undefined ? {} : { testMove: (b: TurnBoard) => hooks.testMove?.(b) ?? null }),
        draw: (el, b) => hooks.draw(ctx, el, b),
      },
      clock,
      screens,
      host: { enter: () => session.enterTurns(), shown: () => session.syncChrome(), toTitle: () => session.toTitle() },
      slug,
      quickChat: MANIFEST.turnsQuickChat,
    });
  }
  // 3. the race: define now (the hub calls start on the countdown)
  const race =
    game.race === undefined
      ? null
      : installRace<R>(hub, {
          slug,
          clock,
          stash: sessionStore,
          isRun: (x): x is R => game.run.validate(x),
          onStart: (r, restored) => session.startRace(r, restored),
          onEnd: () => undefined,
          onExit: () => session.toTitle(),
          notify: (text) => void toast(text, { kind: 'warn' }),
        });
  // 4. the daily: define now; a day that arrives before mount waits
  const daily =
    game.daily === undefined
      ? null
      : installDaily(hub, {
          slug,
          clock,
          events,
          search,
          offline: game.daily.offline,
          onPlay: (s) => session.startDaily(s),
          notify: (kind) => toast(kind === 'queued' ? t('dailySavedOffline') : t('dailyOffline')),
          onDeepLinkTimeout: () => void session.showTitle(),
        });
  // 5. controls and menu navigation
  const controls = defineControls(hub, game.input, typeof innerWidth === 'number' ? innerWidth : 1280);
  // The pad's act and back buttons (the hub's; an older hub copy has none: A and B).
  const navButtons = (): readonly number[] => {
    const buttons: PadButtons | undefined = hub.input.padButtons;
    return [...(buttons?.act ?? [0]), ...(buttons?.back ?? [1])];
  };
  // Pad navigation is off in active play when A or B are the game's there (they would click the HUD).
  const navState = (): NavState => {
    const playing = session.screen === 'play' && !session.paused;
    return {
      screen: session.screen,
      paused: session.paused,
      byDefault: !playing || !controls.usesPadButton(navButtons()),
    };
  };
  // Back and Esc: true only when it went somewhere, so on the title Esc leaves the world's box.
  const stopNav = installMenuNav(hub, {
    active: () => {
      const state = navState();
      return game.nav?.active?.(ctx, state) ?? state.byDefault;
    },
    ring: game.nav?.hubRing === true,
    root: ui.root,
    back: () => {
      if (session.screen === 'pause') session.resume();
      else if (session.screen === 'play') session.pause();
      else if (session.screen === 'result' || session.screen === 'turns') session.toTitle();
      // (an Esc while typing in the lobby's chat stays the chat's)
      else if (isTyping()) return false;
      else return session.leaveOnline();
      return true;
    },
    // In play the game's inputs read Esc (`pause`): the loop acts on it, the kit marks it handled.
    ownsEscape: () => session.screen === 'play' && !session.paused && controls.usesKey('Escape'),
  });
  // Button prompts: bound controls show their key or pad button and answer to it, outside active play.
  const prompts = game.prompts === false ? null : (game.prompts ?? {});
  if (prompts?.bindings !== undefined) setPromptBindings(prompts.bindings);
  const stopPrompts =
    prompts === null
      ? () => undefined
      : installPrompts(hub, {
          root: ui.root,
          active: () => session.screen !== 'play' || session.paused,
          navActive: () => {
            const state = navState();
            return game.nav?.active?.(ctx, state) ?? state.byDefault;
          },
          padStyle: prompts.padStyle,
          arrows: prompts.arrows,
        });
  // 6. page lifecycle: keep the game in progress and the profile when the page hides or closes
  const onHide = (): void => {
    session.saveForLater(true);
    void profile.flush();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onHide();
  };
  const onReset = (): void => resume.clear();
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', onHide);
  events.addEventListener('hub:reset', onReset);
  const setOnlineDown = (down: boolean): void => {
    session.onlineDown = down;
    if (session.screen === 'title') void session.showTitle();
  };
  // 7. hub chrome: another bundle hid the menu button while it should show; the offline title; dropped changes
  const offs = [
    onWindow('hub:menu-visibility', () => session.syncChrome(), events),
    onWindow('hub:offline', () => session.screen === 'title' && void session.showTitle(), events),
    onWindow('hub:online', () => session.screen === 'title' && void session.showTitle(), events),
    onWindow('hub:offline-failed', () => void toast(t('syncFailed'), { kind: 'warn' }), events),
    onWindow('hub:rt-failed', () => setOnlineDown(true), events),
    onWindow('hub:rt-ready', () => setOnlineDown(false), events),
    // 8. control hints follow the device (keys, touch, pad): `html[data-controls]` for CSS and screens
    controlHints(hub, (kind) => (document.documentElement.dataset.controls = kind)),
    stopNav,
    stopPrompts,
  ];
  // In the world's box (hub.md "Playing over the world"): `html[data-embed]` for CSS (no menu button corner to keep clear).
  if (isEmbedded()) document.documentElement.dataset.embed = '1';

  // 9. sound and buzz: unlock on gestures, follow the settings, suspend when hidden
  const audio = createKitAudio({ hooks: game.audio, settings, clock });
  const haptic = makeBuzz({ enabled: () => settings.data.haptics, now: () => clock.now() });

  const ctx = buildContext({
    hub,
    slug,
    clock,
    activity,
    profile,
    settings,
    resume,
    controls,
    session,
    stage: o.stage,
    uiRoot: ui.root,
    audio,
    haptic,
  });
  // Edge swipes and Back pause play instead of leaving (on by default but for turn-based and idle games).
  const guardOn = game.backGuard ?? game.resumeOnClose !== true;
  const backGuard = guardOn === false ? null : pageBackGuard(guardOn === true ? {} : guardOn);
  session.attach({ ctx, pause, daily, race, online, turns, controls, audio, backGuard });
  // 10. the touch layout follows the width (rotation, resize)
  offs.push(ctx.onResize((w) => controls.relayout(w)));

  const booted = (async () => {
    session.showLoading();
    // A seat held after a reload is asked for now, while the game mounts: the hub's grace keeps running.
    const held = online === null ? null : hub.rooms.reclaim().catch(() => null);
    await game.mount(ctx);
    session.loop.start();
    await routeOnce({ session, daily, profile, resume, clock, search, launches, online, saved, turns, held });
    installGameHook({ game, ctx, session, slug, drivers: o.drivers, audio, online, turns });
    document.body.dataset.ready = '1';
  })();
  const dispose = (): void => {
    session.loop.stop();
    online?.leave();
    turns?.close();
    audio.dispose();
    pause.dispose();
    profile.dispose();
    backGuard?.stop();
    for (const off of offs) off();
    document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('pagehide', onHide);
    events.removeEventListener('hub:reset', onReset);
  };
  return { session, booted, dispose };
}
