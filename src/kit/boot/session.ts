/**
 * kit/boot: the play session (title → play → pause → result), the loop and the hub duties around it.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md § "The session"
 *
 * The session owns the game in progress, so the guards hold everywhere:
 * - a daily, race or online game sets the activity (no profile, boards or Continue writes);
 * - every way out of a daily that isn't a win calls `daily.leave()`;
 * - a normal game autosaves to Continue (every 5 s, on pause, on hide, on the
 *   title) and is cleared when it ends; a new game never replaces a saved one
 *   it hasn't seen (the late-load guard);
 * - a finished normal game records boards and stats and calls `onResult`.
 */
import type { PlayMode } from '../core/activity.ts';
import type { Activity } from '../core/activity.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import { isJson, type JsonObject } from '../core/json.ts';
import { t } from '../core/strings.ts';
import type { DailyHandle, DailyStart } from '../daily/index.ts';
import type { ControlsHandle } from '../input/controls.ts';
import { FixedLoop } from '../loop/index.ts';
import { syncMenuButton, type PauseHandle } from '../pause/index.ts';
import type { ResumeSlot } from '../resume/index.ts';
import { randomSeed, SeededRng } from '../rng/index.ts';
import { recordResult } from '../scores/index.ts';
import type { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import { h } from '../ui/dom.ts';
import { loadingScreen, pauseScreen, playScreen, resultScreen, titleScreen, type ScreenActions } from './screens.ts';
import type { GameContext, GameDefinition, NewRunOpts, Outcome } from './types.ts';

/** Autosave a normal game to Continue this often while playing. */
export const AUTOSAVE_MS = 5000;

/** What the session needs; the composition root (defineGame) fills it in. */
export type SessionDeps<P extends JsonObject, R extends JsonObject> = {
  game: GameDefinition<P, R>;
  hub: HubLike;
  clock: Clock;
  activity: Activity;
  resume: ResumeSlot<R>;
  screens: Screens;
  actions: Pick<ScreenActions, 'settings' | 'howTo' | 'race' | 'raceBrowse' | 'online'>;
  today(): string;
};

/** The play session. */
export class Session<P extends JsonObject, R extends JsonObject> {
  run: R | null = null;
  mode: PlayMode | null = null;
  autoplay = false;
  private readonly d: SessionDeps<P, R>;
  private ctxRef: GameContext<P, R> | null = null;
  private pauseRef: PauseHandle | null = null;
  private dailyRef: DailyHandle | null = null;
  private controlsRef: ControlsHandle | null = null;
  private day: DailyStart | null = null;
  private hud: HTMLElement | null = null;
  private lastSave = 0;
  private finished = false;
  readonly loop: FixedLoop;

  constructor(d: SessionDeps<P, R>) {
    this.d = d;
    this.loop = new FixedLoop({
      dt: d.game.stepDt,
      clock: d.clock,
      paused: () => this.screen !== 'play' || this.paused,
      simulate: (dt) => this.simulate(dt),
      render: (alpha) => this.render(alpha),
    });
  }

  attach(parts: {
    ctx: GameContext<P, R>;
    pause: PauseHandle;
    daily: DailyHandle | null;
    controls: ControlsHandle;
  }): void {
    this.ctxRef = parts.ctx;
    this.pauseRef = parts.pause;
    this.dailyRef = parts.daily;
    this.controlsRef = parts.controls;
  }

  private get ctx(): GameContext<P, R> {
    if (!this.ctxRef) throw new Error('session used before defineGame attached it');
    return this.ctxRef;
  }

  get screen(): string {
    return this.d.screens.current;
  }

  get paused(): boolean {
    return this.pauseRef?.paused ?? false;
  }

  /** May the game pause now? Only while playing, never in a race or a live online match. */
  canPause(): boolean {
    return this.screen === 'play' && this.mode !== 'race' && this.mode !== 'online';
  }

  // ---- screens ---------------------------------------------------------------

  private actions(): ScreenActions {
    return {
      ...this.d.actions,
      play: () => void this.newGame(),
      continueSaved: () => void this.continueSaved(),
      daily: () => void this.d.hub.daily.startAndPlay(this.d.today()),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => this.restart(),
      quit: () => this.toTitle(),
    };
  }

  showLoading(): void {
    this.d.screens.show('loading', loadingScreen);
  }

  /** The title screen, with a Continue row when a saved game exists. */
  async showTitle(): Promise<void> {
    const saved = this.d.resume.known ? await this.d.resume.load() : null;
    const { game } = this.d;
    const el = this.d.screens.show('title', () =>
      titleScreen(
        {
          title: game.copy.title,
          tagline: game.copy.tagline,
          continueLabel: saved === null ? null : game.run.progress(saved).label,
          daily: game.daily !== undefined,
          dailyDone: false,
          race: game.race !== undefined,
          online: game.online !== undefined,
        },
        this.actions(),
      ),
    );
    if (this.d.hub.isOffline) el.appendChild(h('p.kit-tagline', { 'data-testid': 'offline-note' }, t('offline')));
    game.screens?.title?.(this.ctx, el, { hasContinue: saved !== null });
    this.syncChrome();
  }

  private showPlay(): void {
    const { el, hud } = playScreen(this.actions());
    this.d.screens.show('play', () => el);
    this.hud = hud;
    this.d.game.screens?.hud?.mount(this.ctx, hud);
    this.syncChrome();
  }

  /** Pause screen (the pause module calls it). */
  showPause(): void {
    this.saveForLater(true);
    const el = this.d.screens.show('pause', () => pauseScreen(this.actions()));
    this.d.game.screens?.pause?.(this.ctx, el);
    this.syncChrome();
  }

  /** Back to play (the pause module calls it). */
  hidePause(): void {
    if (this.run !== null && !this.finished) this.showPlay();
  }

  /** Input groups and the hub menu button follow the screen. */
  syncChrome(): void {
    const playing = this.screen === 'play' && !this.paused;
    this.controlsRef?.sync({ playing });
    syncMenuButton(this.d.hub, { playing: this.screen === 'play', paused: this.paused });
  }

  // ---- starting ---------------------------------------------------------------

  private begin(mode: PlayMode, run: R): void {
    this.run = run;
    this.mode = mode;
    this.finished = false;
    this.lastSave = this.d.clock.now();
    this.d.activity.set(mode);
    this.pauseRef?.resume();
    this.showPlay();
  }

  private build(mode: PlayMode, seed: number, extra: Partial<NewRunOpts> = {}): R {
    return this.d.game.newRun(this.ctx, { mode, seed, rng: new SeededRng(seed), ...extra });
  }

  /** A new normal game. A saved game the lookup hasn't returned yet is offered later, never lost. */
  async newGame(): Promise<void> {
    this.leaveSpecial();
    const { resume } = this.d;
    if (resume.known) {
      if ((await resume.load()) !== null) resume.clear();
    } else {
      resume.offerLate(
        () => this.run,
        (saved) =>
          toast(t('lateSaveBody'), {
            actions: [
              { label: t('keepThisGame'), onClick: () => resume.save(this.run ?? saved), testid: 'late-keep' },
              { label: t('continueSaved'), onClick: () => this.begin('normal', saved), testid: 'late-continue' },
            ],
          }),
      );
    }
    this.begin('normal', this.build('normal', randomSeed()));
  }

  /** Continue the saved game. */
  async continueSaved(): Promise<void> {
    const saved = await this.d.resume.load();
    if (saved === null) return this.newGame();
    this.leaveSpecial();
    this.begin('normal', saved);
  }

  /** A daily starts (from the menu, a deep link or the title's button). A normal game in progress is saved first. */
  startDaily(s: DailyStart): void {
    if (this.mode === 'normal' && this.run !== null && !this.finished) this.d.resume.save(this.run);
    if (this.mode === 'race') this.leaveSpecial();
    this.day = s;
    const saved = s.saved;
    const restored = saved !== null && isJson(saved) && this.d.game.run.validate(saved) ? saved : null;
    this.begin('daily', restored ?? this.build('daily', s.seed, { day: s.day }));
  }

  /** Same kind of game again: a new normal game, or the same day. */
  restart(): void {
    if (this.mode === 'daily' && this.day !== null) {
      this.begin('daily', this.build('daily', this.day.seed, { day: this.day.day }));
      return;
    }
    void this.newGame();
  }

  // ---- leaving ---------------------------------------------------------------

  /** End a daily (unrecorded) or a race when the player goes elsewhere. */
  private leaveSpecial(): void {
    if (this.mode === 'daily') {
      this.dailyRef?.leave();
      this.day = null;
    }
  }

  /** Back to the title, from anywhere. */
  toTitle(): void {
    this.saveForLater(true);
    this.leaveSpecial();
    this.run = null;
    this.mode = null;
    this.d.activity.set(null);
    this.pauseRef?.resume();
    void this.showTitle();
  }

  /** Keep a normal game in progress for Continue (and push it now on `flush`). */
  saveForLater(flush = false): void {
    if (this.mode !== 'normal' || this.run === null || this.finished) return;
    this.d.resume.save(this.run);
    this.lastSave = this.d.clock.now();
    if (flush) this.d.resume.flush();
  }

  pause(): void {
    this.pauseRef?.pause('player');
  }

  resume(): void {
    this.pauseRef?.resume();
  }

  // ---- the loop --------------------------------------------------------------

  private simulate(dt: number): void {
    const run = this.run;
    if (run === null || this.finished) return;
    if (this.d.hub.input.down('pause')) {
      this.pause();
      return;
    }
    if (this.autoplay) this.d.game.autoplay?.(this.ctx, run);
    this.d.game.step(this.ctx, run, dt);
    const outcome = this.d.game.outcome(run);
    if (outcome !== null) {
      this.finish(outcome);
      return;
    }
    if (this.mode === 'normal' && this.d.clock.now() - this.lastSave >= AUTOSAVE_MS) this.saveForLater();
  }

  private render(alpha: number): void {
    this.d.game.render(this.ctx, this.run, alpha);
    if (this.run !== null && this.hud !== null && this.screen === 'play')
      this.d.game.screens?.hud?.update(this.ctx, this.run);
  }

  /** The game ended: results by mode, then the result screen. */
  finish(outcome: Outcome): void {
    const run = this.run;
    const mode = this.mode;
    if (run === null || mode === null || this.finished) return;
    this.finished = true;
    const { game, hub } = this.d;
    const numbers = game.result?.(run, outcome) ?? {};
    if (game.scores) recordResult(hub, game.scores, { mode, ...numbers });
    if (mode === 'normal') {
      this.d.resume.clear();
      game.onResult?.(this.ctx, run, outcome);
    } else if (mode === 'daily' && outcome === 'won') {
      const firstBoard = Object.values(numbers.boards ?? {})[0];
      const meta = {
        ...(firstBoard === undefined ? {} : { score: firstBoard }),
        ...(game.daily?.meta?.(run, outcome) ?? {}),
      };
      this.dailyRef?.complete(meta);
      this.day = null;
    }
    const again = mode === 'normal' || mode === 'daily';
    const el = this.d.screens.show('result', () => resultScreen(outcome === 'won', this.actions(), { again }));
    game.screens?.result?.(this.ctx, el, { run, outcome, mode });
    this.syncChrome();
  }
}
