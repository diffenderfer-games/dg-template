/**
 * kit/boot: the GameDefinition a game hands to `defineGame`, and the context it gets back.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md, docs/kit/hooks.md (every hook, what it does, where its stub is)
 *
 * The game implements hooks (src/game/*, stubs with TODO(game)); the kit does
 * every hub duty around them.
 */
import type { GamePayload, RaceParams, RaceStats, TurnCreateOptions, TurnSummary } from '@diffenderfer-games/hub';
import type { Activity, PlayMode } from '../core/activity.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import type { JsonObject } from '../core/json.ts';
import type { KitStrings } from '../core/strings.ts';
import type { ControlsHandle, InputSpec } from '../input/controls.ts';
import type { PromptBinding } from '../input/glyphs.ts';
import type { PadStyle } from '../input/prompts.ts';
import type { Region } from '../layout/index.ts';
import type { ResumeSlot, ResumeSpec } from '../resume/index.ts';
import type { SeededRng } from '../rng/index.ts';
import type { ProfileSpec, ProfileStore } from '../save/index.ts';
import type { SettingsStore } from '../save/settings.ts';
import type { ScoreSpec } from '../scores/index.ts';
import type { KitSettings } from '../settings-ui/index.ts';
import type { GameHookDrivers } from '../test-hook/index.ts';
import type { AudioHooks, KitAudio } from '../audio/types.ts';
import type { OnlineGame } from '../online/types.ts';
import type { LiveRoomGame } from '../live/types.ts';
import type { AvatarHooks } from '../avatar/types.ts';
import type { BackGuardOptions } from '../ui/back-guard.ts';

/** How a game ended. */
export type Outcome = 'won' | 'lost';

/** What `newRun` gets: the mode and the ONLY randomness it may use. */
export type NewRunOpts = {
  mode: PlayMode;
  seed: number;
  /** Seeded from `seed`: dailies and races give everyone the same game. */
  rng: SeededRng;
  /** A daily: its day (`YYYY-MM-DD`). */
  day?: string;
  /** A race: the creator's params (`game.race.params`). */
  params?: RaceParams;
};

/** The numbers a finished game reports (kit/scores applies the mode rules). */
export type ResultNumbers = {
  boards?: Record<string, number>;
  incr?: Record<string, number>;
  max?: Record<string, number>;
};

/** What the kit's title screen knows (for `screens.title`). */
export type TitleInfo = { hasContinue: boolean };

/** What the result screen knows. */
export type ResultInfo<R> = { run: R; outcome: Outcome; mode: PlayMode };

/** The play session, as the game and the test hook see it. */
export type SessionApi<R> = {
  readonly run: R | null;
  readonly mode: PlayMode | null;
  readonly screen: string;
  readonly paused: boolean;
  /** Start a new normal game (the late-load guard runs first). */
  newGame(): Promise<void>;
  /** Start the same kind of game again (same day for a daily). */
  restart(): void;
  /** Back to the title: leaves any daily, race or room first. */
  toTitle(): void;
  pause(): void;
  resume(): void;
  /** End the game now with this outcome (test drivers, a "give up"). */
  finish(outcome: Outcome): void;
};

/** Everything a hook can use. */
export type GameContext<P extends JsonObject, R extends JsonObject> = {
  readonly hub: HubLike;
  readonly slug: string;
  readonly clock: Clock;
  readonly activity: Activity;
  readonly profile: ProfileStore<P>;
  readonly settings: SettingsStore<KitSettings>;
  readonly resume: ResumeSlot<R>;
  readonly controls: ControlsHandle;
  readonly session: SessionApi<R>;
  readonly audio: KitAudio;
  /** The element the renderer draws into (`#app`). */
  readonly stage: HTMLElement;
  /** The kit's DOM layer (`#ui`). */
  readonly uiRoot: HTMLElement;
  /** The viewport size in CSS px. */
  size(): { width: number; height: number };
  /** Where gameplay may draw: inside the safe area, below the race HUD and the HUD (kit/layout). */
  region(): Region;
  /** Called after every settled resize. */
  onResize(cb: (w: number, h: number) => void): () => void;
  /** A short message to the player. */
  toast(text: string): void;
  /** A buzz (if the player allows vibration). */
  haptic(strong?: boolean): void;
};

/** The game's HUD, drawn over play (DOM). */
export type HudHooks<P extends JsonObject, R extends JsonObject> = {
  mount(ctx: GameContext<P, R>, el: HTMLElement): void;
  update(ctx: GameContext<P, R>, run: R): void;
};

/** Optional decorations of the kit's screens (each gets the screen's element). */
export type ScreenHooks<P extends JsonObject, R extends JsonObject> = {
  title?(ctx: GameContext<P, R>, el: HTMLElement, info: TitleInfo): void;
  hud?: HudHooks<P, R>;
  pause?(ctx: GameContext<P, R>, el: HTMLElement): void;
  result?(ctx: GameContext<P, R>, el: HTMLElement, info: ResultInfo<R>): void;
};

/** Daily challenges (needs `game.dailyChallenges: true`). */
export type DailyHooks<R extends JsonObject> = {
  /** Extra `hub.daily.complete` fields (stars, attempts…; `score` defaults to the result's first board). */
  meta?(run: R, outcome: Outcome): JsonObject;
  /** Offline: play the day unrecorded (default), or just say it needs a connection. */
  offline?: 'play-unrecorded' | 'toast';
};

/** Races (needs `game.race`). */
export type RaceHooks<R extends JsonObject> = {
  /** Live stats for the HUD: numbers, booleans or `#rrggbb`, never text; at most 12. */
  stats(run: R): RaceStats;
  /** 0..1, how far along (the HUD bars). */
  progress?(run: R): number;
  /** Race params for the Race button (`hub.race.create`); default: the manifest defaults. */
  params?(): RaceParams;
};

/** What the game's board gets in an online game the hub runs (kit/turns). */
export type TurnBoard = {
  /** The game as this player sees it: the rules' `view(state, mySeat)` (null in the lobby). Validate it. */
  readonly view: GamePayload | null;
  readonly summary: TurnSummary;
  readonly mySeat: number | null;
  /** This player may move now: it is their turn, or a move out of turn (`mayAct`). */
  readonly canMove: boolean;
  /** Make a move; a refused one shows the hub's words and the board stays as it was. */
  move(move: GamePayload): Promise<void>;
  /**
   * The creator takes the player in `seat` out, after the kit's confirm (a
   * board that draws its own seats offers it); null when this player can't:
   * not the creator, their own seat, or a client without `kick`.
   */
  readonly remove: ((seat: number) => void) | null;
};

/**
 * Online games the hub runs (needs `game.turns` in package.json and the
 * rules module src/game/turns/rules.ts; docs/kit/turns.md). The kit does the
 * rest: the title's Play online, the lobby, whose move it is, who is
 * there, the hand-over to the computer, chat with `game.turns.quickChat`,
 * Your games, invite links, the rematch.
 */
export type TurnsHooks<P extends JsonObject, R extends JsonObject> = {
  /** Draw the board into `el` (DOM); called on every change. */
  draw(ctx: GameContext<P, R>, el: HTMLElement, board: TurnBoard): void;
  /** What every new game is made with (`hub.turns.create`): a mode, options, seats, a deadline. */
  create?: Pick<TurnCreateOptions, 'mode' | 'options' | 'seats' | 'deadline'>;
  /**
   * Test contract: a legal move for this player from the board, or null (`__game.turnsMove()`
   * makes it). The kit's hub suite plays online games with it (docs/kit/testing.md).
   */
  testMove?(board: TurnBoard): GamePayload | null;
};

/** What the kit's menu navigation knows when it asks `nav.active`. */
export type NavState = {
  readonly screen: string;
  readonly paused: boolean;
  /** The default answer: false in active play when the game's `play` inputs use the pad's act or back button. */
  readonly byDefault: boolean;
};

/** Gamepad and keyboard menus (docs/kit/input.md § "Menus"). */
export type NavHooks<P extends JsonObject, R extends JsonObject> = {
  /**
   * Is the kit's pad navigation on now? Default `state.byDefault`: everywhere but active play whose
   * `play` inputs use the pad's act (A) or back (B) button, so A and B are the game's there and
   * never click a HUD button. Return true to navigate the play screen's `[data-nav]` too.
   */
  active?(ctx: GameContext<P, R>, state: NavState): boolean;
  /** Draw the hub's ring over the kit's focused control too (default false: the kit's CSS, `--kit-focus-*`). */
  hubRing?: boolean;
};

/**
 * Button prompts (docs/kit/input.md § "Button prompts"): controls bound to actions show their key or pad
 * button and answer to it.
 */
export type PromptOptions = {
  /** Change the kit's actions or add the game's (merged over `DEFAULT_PROMPT_BINDINGS`). */
  bindings?: Readonly<Record<string, Partial<PromptBinding>>>;
  /** Pad glyphs: from the pad's id (`auto`, default), or always Xbox or PlayStation. */
  padStyle?: PadStyle | 'auto';
  /** Arrows move focus between the controls outside play (default true). */
  arrows?: boolean;
};

/** The whole game, as `defineGame` takes it. */
export type GameDefinition<P extends JsonObject, R extends JsonObject> = {
  /**
   * The game's id, the key of everything the kit stores. Default: package.json's `game.id`, else the hub's
   * slug (the id the host injects), else the page's first path segment. Don't set it: a renamed game sets
   * `game.id` in package.json instead.
   */
  slug?: string;
  /** The title screen's words. */
  copy: { title: string; tagline?: string; howTo?: readonly string[] };
  profile: ProfileSpec<P>;
  /** The game in progress: shape version, validation and the "Your games" label. */
  run: ResumeSpec<R>;
  input: InputSpec;
  /** Gamepad menus: when the kit navigates them, and whose focus look shows (docs/kit/input.md § "Menus"). */
  nav?: NavHooks<P, R>;
  /** Button prompts and their bindings (default on); `false` turns them off. */
  prompts?: PromptOptions | false;
  /**
   * The back guard in play (kit/ui/back-guard.ts; docs/kit/ui.md § "The back guard"): edge swipes
   * and the phone's Back pause instead of leaving. Default on, except for games that resume when
   * hub UI closes (`resumeOnClose`: turn-based and idle). `false` turns it off; options tune it.
   */
  backGuard?: boolean | BackGuardOptions;
  scores?: ScoreSpec;
  strings?: Partial<KitStrings>;
  /** Turn-based and idle games resume when hub UI closes; action games show the pause screen. */
  resumeOnClose?: boolean;
  /** Seconds per simulation step (default 1/60). */
  stepDt?: number;

  /** Build the renderer and the scene (once). */
  mount(ctx: GameContext<P, R>): Promise<void> | void;
  /** A new game. Use ONLY `opts.rng` for randomness. */
  newRun(ctx: GameContext<P, R>, opts: NewRunOpts): R;
  /** Advance the game by `dt` seconds (fixed step). Read input with `ctx.hub.input`. */
  step(ctx: GameContext<P, R>, run: R, dt: number): void;
  /** Draw (every frame; `run` is null on menus). */
  render(ctx: GameContext<P, R>, run: R | null, alpha: number): void;
  /** Is the game over? */
  outcome(run: R): Outcome | null;
  /** The numbers for boards and stats. */
  result?(run: R, outcome: Outcome): ResultNumbers;
  /** A normal game ended: update the profile (bests, unlocks). Dailies and races never reach here. */
  onResult?(ctx: GameContext<P, R>, run: R, outcome: Outcome): void;
  /** A JSON summary for tests and screenshots (`__game.snap()`). */
  snap?(run: R | null): JsonObject;
  /** Test driver: steer one step toward winning (`__game.autoplay`). */
  autoplay?(ctx: GameContext<P, R>, run: R): void;
  /**
   * Test driver: add `n` to the score (`__game.addScore`). Part of the test contract
   * (docs/kit/testing.md § "What the kit's tests need from your game"): `snap(run).score` shows it.
   */
  addScore?(run: R, n: number): void;
  /** Test driver: make the game won now (`__game.solveNow`). */
  solve?(run: R): void;
  /** Extra test drivers (src/game/test-hook.ts). */
  testHook?(ctx: GameContext<P, R>): GameHookDrivers['extra'];
  /** The game's own settings rows. */
  settingsRows?(ctx: GameContext<P, R>): HTMLElement[];

  screens?: ScreenHooks<P, R>;
  daily?: DailyHooks<R>;
  race?: RaceHooks<R>;
  /** Online play in hub rooms: `onlineGame({ ... })` from src/game/online.ts. */
  online?: OnlineGame;
  /**
   * Live play (docs/kit/live.md): a hub room is the lobby and the hub's live server runs
   * src/game/live/sim.ts; needs `game.multiplayer` and `game.live`. Instead of `online`.
   */
  live?: LiveRoomGame;
  /** Online games, run by the hub from src/game/turns/rules.ts (src/game/turns/board.ts). */
  turns?: TurnsHooks<P, R>;
  avatar?: AvatarHooks;
  audio?: AudioHooks;
};
