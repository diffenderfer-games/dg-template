/**
 * kit/boot: the play session (title → play → pause → result), the loop and the hub duties around it.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md § "The session"
 *
 * The session owns the game in progress, so the guards hold everywhere:
 * - a daily, race or online game sets the activity (no profile, boards or Continue writes);
 * - every way out of a daily that isn't a win calls `daily.leave()`; leaving a
 *   race or a room leaves it with the hub;
 * - a normal game autosaves to Continue (every 5 s, on pause, on hide, on the
 *   title) and is cleared when it ends; a new game never replaces a saved one
 *   it hasn't seen (the late-load guard);
 * - a race is never paused (the pause button asks "Leave race?"), input waits
 *   for the go, status is reported, and finish/lose are sent once;
 * - a finished game records boards and stats by mode and calls `onResult` for normal games.
 */
import type { RaceStart } from '@diffenderfer-games/hub';
import type { Activity, PlayMode } from '../core/activity.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import { isJson, type JsonObject } from '../core/json.ts';
import { t } from '../core/strings.ts';
import type { DailyHandle, DailyStart } from '../daily/index.ts';
import type { ControlsHandle } from '../input/controls.ts';
import { FixedLoop } from '../loop/index.ts';
import { syncMenuButton, type PauseHandle } from '../pause/index.ts';
import type { RaceHandle } from '../race/index.ts';
import type { ResumeSlot } from '../resume/index.ts';
import { randomSeed, SeededRng } from '../rng/index.ts';
import { recordResult } from '../scores/index.ts';
import { h } from '../ui/dom.ts';
import { confirm } from '../ui/modal.ts';
import type { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import type { RunningAudio } from '../audio/kit-audio.ts';
import type { OnlineFlow } from './online-flow.ts';
import type { ContinueRow, SavedHandle } from '../saved/index.ts';
import { quickMatch } from '../world/index.ts';
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
  actions: Pick<ScreenActions, 'settings' | 'howTo'>;
  today(): string;
  /** "Your games" (hub.saved when the hub has it, else the one saved game). */
  saved: SavedHandle;
};

/** The parts defineGame attaches after building them. */
export type SessionParts<P extends JsonObject, R extends JsonObject> = {
  ctx: GameContext<P, R>;
  pause: PauseHandle;
  daily: DailyHandle | null;
  race: RaceHandle<R> | null;
  online: OnlineFlow | null;
  controls: ControlsHandle;
  audio: RunningAudio;
};

/** The play session. */
export class Session<P extends JsonObject, R extends JsonObject> {
  run: R | null = null;
  mode: PlayMode | null = null;
  autoplay = false;
  /** The hub's social runtime failed (hub:rt-failed); cleared by hub:rt-ready. */
  onlineDown = false;
  readonly loop: FixedLoop;
  private readonly d: SessionDeps<P, R>;
  private parts: SessionParts<P, R> | null = null;
  private day: DailyStart | null = null;
  private hud: HTMLElement | null = null;
  private lastSave = 0;
  private finished = false;
  private rows: ContinueRow[] = [];

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

  attach(parts: SessionParts<P, R>): void {
    this.parts = parts;
  }

  private get p(): SessionParts<P, R> {
    if (!this.parts) throw new Error('session used before defineGame attached it');
    return this.parts;
  }

  private get ctx(): GameContext<P, R> {
    return this.p.ctx;
  }

  get screen(): string {
    return this.d.screens.current;
  }

  get paused(): boolean {
    return this.parts?.pause.paused ?? false;
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
      continueSaved: (id) => {
        const row = this.rows.find((r) => r.id === id);
        if (row === undefined || row.kind === 'run') void this.continueSaved();
        else this.d.saved.open(row.id, row.kind);
      },
      quickMatch: () => void quickMatch(this.d.hub)?.(),
      daily: () => void this.d.hub.daily.startAndPlay(this.d.today()),
      race: () => this.parts?.race?.create(this.d.game.race?.params?.()),
      raceBrowse: () => this.parts?.race?.browse(),
      online: () => void this.parts?.online?.hostRoom(),
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
    const rows = (this.rows = await this.d.saved.continueRows(() =>
      Promise.resolve(saved === null ? null : game.run.progress(saved).label),
    ));
    const el = this.d.screens.show('title', () =>
      titleScreen(
        {
          title: game.copy.title,
          tagline: game.copy.tagline,
          continueRows: rows,
          quickMatch: game.online !== undefined && quickMatch(this.d.hub) !== null,
          daily: game.daily !== undefined,
          dailyDone: false,
          race: game.race !== undefined,
          online: game.online !== undefined,
          onlineDown: this.onlineDown,
        },
        this.actions(),
      ),
    );
    if (this.d.hub.isOffline) el.appendChild(h('p.kit-tagline', { 'data-testid': 'offline-note' }, t('offline')));
    game.screens?.title?.(this.ctx, el, { hasContinue: rows.length > 0 });
    this.syncChrome();
  }

  /** The play screen (HUD for single-player games). */
  showPlay(): void {
    const { el, hud } = playScreen(this.actions());
    this.d.screens.show('play', () => el);
    this.hud = hud;
    if (this.run !== null) this.d.game.screens?.hud?.mount(this.ctx, hud);
    this.syncChrome();
  }

  /** Pause screen (the pause module calls it). */
  showPause(): void {
    this.saveForLater(true);
    this.parts?.audio.duck(true);
    const el = this.d.screens.show('pause', () => pauseScreen(this.actions()));
    this.d.game.screens?.pause?.(this.ctx, el);
    this.syncChrome();
  }

  /** Back to play (the pause module calls it). */
  hidePause(): void {
    this.parts?.audio.duck(false);
    if (this.run !== null && !this.finished) this.showPlay();
  }

  /** Input groups and the hub menu button follow the screen. */
  syncChrome(): void {
    const playing = this.screen === 'play' && !this.paused;
    this.parts?.controls.sync({ playing });
    syncMenuButton(this.d.hub, { playing: this.screen === 'play', paused: this.paused });
  }

  /** The result screen: Play again only where it makes sense (normal, daily). */
  showResult(won: boolean, again: boolean): HTMLElement {
    const el = this.d.screens.show('result', () => resultScreen(won, this.actions(), { again }));
    this.syncChrome();
    return el;
  }

  // ---- starting ---------------------------------------------------------------

  private begin(mode: PlayMode, run: R): void {
    this.run = run;
    this.mode = mode;
    this.finished = false;
    this.lastSave = this.d.clock.now();
    this.d.activity.set(mode);
    this.parts?.pause.resume();
    this.parts?.audio.startMusic();
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

  /** A daily starts (the menu, a deep link or the title's button). A normal game is saved first. */
  startDaily(s: DailyStart): void {
    if (this.mode === 'normal' && this.run !== null && !this.finished) this.d.resume.save(this.run);
    if (this.mode === 'race' || this.mode === 'online') this.leaveSpecial();
    this.day = s;
    const saved = s.saved;
    const restored = saved !== null && isJson(saved) && this.d.game.run.validate(saved) ? saved : null;
    this.begin('daily', restored ?? this.build('daily', s.seed, { day: s.day }));
  }

  /** A race's countdown began (or it restarted after a reload, with the stashed game). */
  startRace(r: RaceStart, restored: R | null): void {
    if (this.mode === 'normal') this.saveForLater(true);
    if (this.mode === 'daily' || this.mode === 'online') this.leaveSpecial();
    this.begin('race', restored ?? this.build('race', r.seed, { params: r.params }));
  }

  /** Enter online play (the lobby). */
  enterOnline(): void {
    if (this.mode === 'normal') this.saveForLater(true);
    if (this.mode === 'daily' || this.mode === 'race') this.leaveSpecial();
    this.run = null;
    this.mode = 'online';
    this.finished = false;
    this.d.activity.set('online');
    this.showLoading();
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

  /** End a daily (unrecorded), a race or a room when the player goes elsewhere. */
  private leaveSpecial(): void {
    if (this.mode === 'daily') {
      this.parts?.daily?.leave();
      this.day = null;
    } else if (this.mode === 'race' && this.parts?.race?.current) {
      this.parts.race.leave();
    } else if (this.mode === 'online') {
      this.parts?.online?.leave();
    }
  }

  /** Back to the title, from anywhere. */
  toTitle(): void {
    this.saveForLater(true);
    this.leaveSpecial();
    this.run = null;
    this.mode = null;
    this.d.activity.set(null);
    this.parts?.pause.resume();
    void this.showTitle();
  }

  /**
   * Keep the game in progress for Continue (and push it now on `flush`). A
   * daily goes to the day's own save once the hub has days in progress
   * (kit/resume routes it; a no-op before saved-games phase 1).
   */
  saveForLater(flush = false): void {
    if ((this.mode !== 'normal' && this.mode !== 'daily') || this.run === null || this.finished) return;
    this.d.resume.save(this.run);
    this.lastSave = this.d.clock.now();
    if (flush) this.d.resume.flush();
  }

  /** The player's pause: in a race it asks "Leave race?" instead (arrow-escape guardRace). */
  pause(): void {
    if (this.mode === 'race' && this.parts?.race?.live) {
      void confirm({ title: t('leaveRace'), body: t('leaveRaceBody'), yes: t('leave'), no: t('stay') }).then((yes) => {
        if (yes) this.toTitle();
      });
      return;
    }
    this.parts?.pause.pause('player');
  }

  resume(): void {
    this.parts?.pause.resume();
  }

  // ---- the loop --------------------------------------------------------------

  private simulate(dt: number): void {
    if (this.mode === 'online') {
      this.parts?.online?.frame(dt);
      return;
    }
    const run = this.run;
    if (run === null || this.finished) return;
    if (this.d.hub.input.down('pause')) {
      this.pause();
      return;
    }
    const race = this.mode === 'race' ? (this.parts?.race ?? null) : null;
    if (race?.locked() === true) return; // before the go, after the end
    if (this.autoplay) this.d.game.autoplay?.(this.ctx, run);
    this.d.game.step(this.ctx, run, dt);
    const raceHooks = this.d.game.race;
    if (race && raceHooks) race.report(run, raceHooks.stats(run), raceHooks.progress?.(run));
    const outcome = this.d.game.outcome(run);
    if (outcome !== null) {
      this.finish(outcome);
      return;
    }
    if (this.d.clock.now() - this.lastSave >= AUTOSAVE_MS) this.saveForLater();
  }

  private render(alpha: number): void {
    if (this.mode === 'online' && this.parts?.online) {
      this.parts.online.render();
      return;
    }
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
      this.parts?.daily?.complete(meta);
      this.day = null;
    } else if (mode === 'race' && game.race) {
      const stats = game.race.stats(run);
      if (outcome === 'won') this.parts?.race?.finish(stats);
      else this.parts?.race?.lose(stats);
    }
    this.parts?.audio.play(outcome === 'won' ? 'win' : 'lose');
    const el = this.showResult(outcome === 'won', mode === 'normal' || mode === 'daily');
    game.screens?.result?.(this.ctx, el, { run, outcome, mode });
  }
}
