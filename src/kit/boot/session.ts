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
import { closeTopModal, confirm } from '../ui/modal.ts';
import type { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import type { RunningAudio } from '../audio/kit-audio.ts';
import { titleDemo } from '../avatar/index.ts';
import type { JoinKinds, JoinTarget } from './joining.ts';
import type { OnlineFlow } from './online-flow.ts';
import type { TurnsFlow } from './turns-flow.ts';
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
  turns: TurnsFlow | null;
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
  /** Today's daily is done (the title's "Done today"); refreshed from `hub.daily.status()` on each title. */
  private dailyDone = false;
  readonly loop: FixedLoop;
  private readonly d: SessionDeps<P, R>;
  private parts: SessionParts<P, R> | null = null;
  private day: DailyStart | null = null;
  private hud: HTMLElement | null = null;
  private lastSave = 0;
  private finished = false;
  private rows: ContinueRow[] = [];
  /** "Leave race?" is open. */
  private askingLeave = false;
  /** The `pause` input was held last step. */
  private pauseHeld = false;

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
      online: () => this.parts?.online?.choose(this.joinCode()),
      turns: () => this.parts?.turns?.choose(this.joinCode()),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => this.restart(),
      quit: () => this.toTitle(),
    };
  }

  /** Join with a code from an online chooser: a room's code (live rooms), or an online game's invite link. */
  private joinCode(): { kinds: JoinKinds; go(target: JoinTarget): void } {
    const online = this.parts?.online ?? null;
    const turns = this.parts?.turns ?? null;
    return {
      kinds: { rooms: online !== null, turns: turns !== null },
      go: (target) => {
        if (target.kind === 'room') void online?.joinRoom(target.code, false);
        else void turns?.join(target.key);
      },
    };
  }

  showLoading(): void {
    this.d.screens.show('loading', loadingScreen);
  }

  /** Ask the hub whether today's daily is done; redraw the title if that changed. */
  private async refreshDailyDone(): Promise<void> {
    let done: boolean;
    try {
      const status = await this.d.hub.daily.status();
      done = status.completions[status.today] !== undefined;
    } catch {
      return; // offline or no dailies: leave it as it was
    }
    if (done === this.dailyDone) return;
    this.dailyDone = done;
    if (this.screen === 'title') await this.showTitle();
  }

  /** "Your games" changed: redraw the title only if its Continue rows did (a save fires it often). */
  async refreshContinue(): Promise<void> {
    if (this.screen !== 'title') return;
    const saved = this.d.resume.known ? await this.d.resume.load() : null;
    const rows = await this.d.saved.continueRows(() =>
      Promise.resolve(saved === null ? null : this.d.game.run.progress(saved).label),
    );
    if (this.screen === 'title' && this.mode === null && JSON.stringify(rows) !== JSON.stringify(this.rows))
      await this.showTitle();
  }

  /** The title screen, with a Continue row when a saved game exists. */
  async showTitle(): Promise<void> {
    const saved = this.d.resume.known ? await this.d.resume.load() : null;
    const { game } = this.d;
    const rows = await this.d.saved.continueRows(() =>
      Promise.resolve(saved === null ? null : game.run.progress(saved).label),
    );
    if (this.mode !== null || this.parts?.turns?.active === true) return; // a game started while the rows loaded (a daily from the menu, a launch, an online game)
    this.rows = rows;
    const el = this.d.screens.show('title', () =>
      titleScreen(
        {
          title: game.copy.title,
          tagline: game.copy.tagline,
          continueRows: rows,
          quickMatch: game.online !== undefined && quickMatch(this.d.hub) !== null,
          daily: game.daily !== undefined,
          dailyDone: this.dailyDone,
          race: game.race !== undefined,
          online: game.online !== undefined || game.live !== undefined,
          turns: this.parts?.turns !== null && this.parts?.turns !== undefined,
          onlineDown: this.onlineDown,
        },
        this.actions(),
      ),
    );
    if (this.d.hub.isOffline) el.appendChild(h('p.kit-tagline', { 'data-testid': 'offline-note' }, t('offline')));
    game.screens?.title?.(this.ctx, el, { hasContinue: rows.length > 0 });
    // The player's bust and Edit avatar under the buttons, only when the game asks for them
    // (`avatar.titleDemo: true`) and its title hook hasn't placed them already.
    if (game.avatar !== undefined && game.avatar.titleDemo === true && !el.querySelector('[data-testid="avatar-demo"]'))
      titleDemo(this.d.hub, el);
    if (game.daily !== undefined) void this.refreshDailyDone();
    this.syncChrome();
  }

  /** The play screen (HUD for single-player games); returns the HUD's element (a live game mounts its own there). */
  showPlay(): HTMLElement {
    const { el, hud } = playScreen(this.actions());
    this.d.screens.show('play', () => el);
    this.hud = hud;
    if (this.run !== null) this.d.game.screens?.hud?.mount(this.ctx, hud);
    this.syncChrome();
    // A key still held as play shows (the Esc that resumed) must come up before it pauses.
    this.pauseHeld = this.d.hub.input.value('pause') >= 0.5;
    return hud;
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

  /**
   * A daily starts (the menu, a deep link, the title's button or Your games).
   * A normal game was already saved when the menu opened (the pause saves);
   * it can't be saved now, as the hub would save it to the day.
   */
  startDaily(s: DailyStart): void {
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

  /** An online game the hub runs opens (kit/turns): the game in progress is saved, a daily paused, a race or room left. */
  enterTurns(): void {
    this.saveForLater(true);
    this.leaveSpecial();
    this.run = null;
    this.mode = null;
    this.finished = false;
    this.d.activity.set('online');
  }

  /** Same kind of game again: a new normal game, or the same day from its seed. */
  restart(): void {
    if (this.mode === 'daily' && this.day !== null) {
      this.d.resume.clear(); // the day's saved state starts over too
      this.begin('daily', this.build('daily', this.day.seed, { day: this.day.day }));
      return;
    }
    void this.newGame();
  }

  // ---- leaving ---------------------------------------------------------------

  /** Pause a daily (it stays in Your games), leave a race or a room, when the player goes elsewhere. */
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

  /** Back to the title, from anywhere (an online game the hub runs stops following; the hub keeps it). */
  toTitle(): void {
    this.saveForLater(true);
    this.leaveSpecial();
    this.parts?.turns?.close();
    this.run = null;
    this.mode = null;
    this.d.activity.set(null);
    this.parts?.pause.resume();
    void this.showTitle();
  }

  /**
   * Keep the game in progress for Continue (and push it now on `flush`). A
   * daily goes to the day's own save (kit/resume routes it), so the day is
   * picked up where the player left it.
   */
  saveForLater(flush = false): void {
    if ((this.mode !== 'normal' && this.mode !== 'daily') || this.run === null || this.finished) return;
    this.d.resume.save(this.run);
    this.lastSave = this.d.clock.now();
    if (flush) this.d.resume.flush();
  }

  /**
   * The player's pause: in a race it asks "Leave race?" instead (arrow-escape guardRace);
   * pausing again while it asks (Esc, Start) answers Stay.
   */
  pause(): void {
    const racing = this.mode === 'race' && this.parts?.race?.live === true;
    // A match with others (a room's) goes on too: no pausing it, only leaving.
    const inMatch = this.mode === 'online' && this.parts?.online?.match.playing === true;
    if (racing || inMatch) {
      if (this.askingLeave) {
        this.askingLeave = false;
        closeTopModal();
        return;
      }
      this.askingLeave = true;
      const words = racing
        ? { title: t('leaveRace'), body: t('leaveRaceBody') }
        : { title: t('leaveMatch'), body: t('leaveMatchBody') };
      void confirm({ ...words, yes: t('leave'), no: t('stay') }).then((yes) => {
        this.askingLeave = false;
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
      // The pause input asks to leave the match (it never pauses: the others play on).
      const held = this.d.hub.input.value('pause') >= 0.5;
      if (held && !this.pauseHeld) this.pause();
      this.pauseHeld = held;
      this.parts?.online?.frame(dt);
      return;
    }
    const run = this.run;
    if (run === null || this.finished) return;
    // A press per step, not per frame (input.md: `down` is per frame, so a frame with no step
    // would miss it and one with two would see it twice: the race's "Leave race?" opened and shut).
    const held = this.d.hub.input.value('pause') >= 0.5;
    const pressed = held && !this.pauseHeld;
    this.pauseHeld = held;
    if (pressed) {
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
    } else if (mode === 'daily' && outcome !== 'won') {
      this.d.resume.clear(); // a lost day starts over from its seed next time; it stays in progress
    } else if (mode === 'daily') {
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
