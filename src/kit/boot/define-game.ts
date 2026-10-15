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
import { controlHints, defineControls, installMenuNav } from '../input/index.ts';
import { onWindow } from '../core/events.ts';
import { createKitAudio } from '../audio/kit-audio.ts';
import { makeBuzz } from '../haptics/index.ts';
import { installLaunches } from '../online/launch.ts';
import { installPause } from '../pause/index.ts';
import { installRace } from '../race/index.ts';
import { createResume } from '../resume/index.ts';
import { createProfile } from '../save/profile.ts';
import { createSettings } from '../save/settings.ts';
import { kitSettingsDefaults, settingsSheet, type KitSettings } from '../settings-ui/index.ts';
import { mountUi } from '../ui/root.ts';
import { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import { buildContext } from './context.ts';
import { OnlineFlow } from './online-flow.ts';
import { routeOnce } from './router.ts';
import { howToModal } from './screens.ts';
import { Session } from './session.ts';
import { installGameHook } from './test-hook.ts';
import type { GameDefinition } from './types.ts';

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
  const slug = game.slug ?? hub.slug ?? location.pathname.split('/').filter(Boolean)[0] ?? 'game';
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

  const session: Session<P, R> = new Session<P, R>({
    game,
    hub,
    clock,
    activity,
    resume,
    screens,
    today,
    actions: {
      settings: () => settingsSheet({ settings, rows: () => game.settingsRows?.(ctx) ?? [] }),
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
  const online =
    game.online === undefined
      ? null
      : new OnlineFlow(hub, game.online, clock, screens, {
          enter: () => session.enterOnline(),
          showPlay: () => session.showPlay(),
          showResult: (won) => void session.showResult(won, false),
          toTitle: () => session.toTitle(),
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
  installMenuNav(hub, {
    root: ui.root,
    back: () => {
      if (session.screen === 'pause') session.resume();
      else if (session.screen === 'play') session.pause();
      else if (session.screen === 'result') session.toTitle();
    },
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
  ];

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
  session.attach({ ctx, pause, daily, race, online, controls, audio });

  const booted = (async () => {
    session.showLoading();
    await game.mount(ctx);
    session.loop.start();
    await routeOnce({ session, daily, profile, resume, clock, search, launches, online });
    installGameHook({ game, ctx, session, slug, drivers: o.drivers, audio });
    document.body.dataset.ready = '1';
  })();
  const dispose = (): void => {
    session.loop.stop();
    online?.leave();
    audio.dispose();
    pause.dispose();
    profile.dispose();
    for (const off of offs) off();
    document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('pagehide', onHide);
    events.removeEventListener('hub:reset', onReset);
  };
  return { session, booted, dispose };
}
