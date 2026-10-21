/**
 * kit/core: the part of the hub client the kit uses, as structural types.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 *
 * Every kit module takes a `HubLike` instead of importing the hub client, so
 * a `FakeHub` (kit/testing) can drive it in unit tests. The types come from
 * the pinned `@diffenderfer-games/hub` with `import type` only, so a client
 * update that changes a signature fails the typecheck
 * (tests/kit/testing/contract.test.ts checks the real `Hub` is a `HubLike`).
 *
 * The hub's sub-objects are classes with private fields, so the kit picks the
 * public members it needs rather than `Pick<Hub, …>` (a class with privates
 * can't be implemented structurally).
 *
 * Saved games (`hub.saved`, the daily's days in progress), online games over
 * days (`hub.turns`) and avatars (`hub.avatar`, `hub.userId()`) are live in
 * the pinned client, so they are required here. Only the world's extras
 * (planned.ts) stay optional.
 */
import type {
  AvatarModule,
  DailySystem,
  GamePayload,
  ResumeLoadOptions,
  Save,
  HubAvatar,
  HubMpApi,
  HubNotifyApi,
  HubPresenceApi,
  HubRaceApi,
  HubResume,
  HubRoomsApi,
  HubSaved,
  HubSocialApi,
  HubTurns,
  InputSystem,
  OpenTurnGame,
  TurnCreateOptions,
  TurnGame,
  UiStack,
  Hub,
} from '@diffenderfer-games/hub';
import type { PlannedMpExtras } from './planned.ts';

/** The overlay stack: pause when hub UI covers the game (multiplayer.md §4). */
export type OverlayLike = Pick<UiStack, 'autoPause' | 'on' | 'isOpen' | 'canPause'>;

/** The input system (hub.md "Input system"). */
export type InputLike = Pick<
  InputSystem,
  | 'define'
  | 'enable'
  | 'disable'
  | 'isEnabled'
  | 'vector'
  | 'down'
  | 'pressed'
  | 'value'
  | 'on'
  | 'source'
  | 'touchDevice'
  | 'autoNavigate'
  | 'clearAutoNavigate'
  | 'setInsets'
  | 'padButtons'
  | 'setPadButtons'
>;

/** Show/hide the hub's menu button. */
export type MenuLike = Pick<Hub['menu'], 'setVisible' | 'visible'>;

/**
 * Daily challenges, with days in progress (hub.md "Days in progress"): a
 * started day is a saved game; `cancel` pauses it, `discard` gives it up,
 * `resume(id)` picks it up again with `challenge.saved`.
 */
export type DailyLike = Pick<
  DailySystem,
  'active' | 'define' | 'complete' | 'cancel' | 'status' | 'startAndPlay' | 'save' | 'resume' | 'discard' | 'inProgress'
>;

/**
 * The run slot behind the home page's Resume card. `load` is typed as
 * returning plain JSON (the kit validates it) instead of the client's generic.
 */
export type ResumeLike = Pick<HubResume, 'requested' | 'blockedBy' | 'save' | 'flush' | 'clear'> & {
  load(options?: ResumeLoadOptions): Promise<GamePayload | null>;
};

/** "Your games" for this game (hub.md "Saved games"). */
export type SavedLike = Pick<HubSaved, 'opened' | 'list' | 'onOpen' | 'open' | 'discard' | 'on'>;

/**
 * An open online game the hub runs (multiplayer.md §16.3), as the kit uses
 * it: who is there (`summary.seats[].connected`, `canLetComputerPlay()`),
 * moves out of turn (`mayActNow`), chat and the rematch. `rematch` gives
 * back a `TurnGameLike`, so a fake can stand in for the client's class.
 */
export type TurnGameLike = Pick<
  TurnGame,
  | 'id'
  | 'summary'
  | 'view'
  | 'mySeat'
  | 'outcome'
  | 'chat'
  | 'chatMode'
  | 'link'
  | 'mayActNow'
  | 'start'
  | 'move'
  | 'history'
  | 'leave'
  | 'nudge'
  | 'setNotify'
  | 'say'
  | 'canLetComputerPlay'
  | 'letComputerPlay'
  | 'close'
  | 'on'
  | 'invite'
> & {
  rematch(): Promise<TurnGameLike>;
  /** Creator: take a player out (hub client next.12+; absent on older clients, so the kit offers it only when there). */
  kick?(seat: number): Promise<void>;
};

/**
 * `hub.turns` (multiplayer.md §16.3). Its games are `TurnGameLike`, so a fake can stand in.
 * `openLobbies` lists games waiting for a player (not the player's own; it rejects on a hub
 * without it, so the kit falls back to making a game).
 */
export type TurnsLike = {
  readonly link: HubTurns['link'];
  create(options?: TurnCreateOptions): Promise<TurnGameLike>;
  join(idOrLinkKey: string): Promise<TurnGameLike>;
  open(id: string): Promise<TurnGameLike>;
  openLobbies(): Promise<OpenTurnGame[]>;
};

/**
 * Players' avatars without the renderer (hub.md "Avatars"). `load()` brings
 * in the renderer with its art; the kit only needs it to register
 * `<dg-avatar>`, so that is all a fake has to give back.
 */
export type AvatarLike = Pick<HubAvatar, 'mine' | 'mineSync' | 'of' | 'from' | 'bot' | 'on' | 'openDesigner'> & {
  load(): Promise<Pick<AvatarModule, 'defineAvatarElement'>>;
};

/** Races (multiplayer.md §14). */
export type RaceLike = Pick<
  HubRaceApi,
  'define' | 'create' | 'browse' | 'openHistory' | 'status' | 'finish' | 'lose' | 'leave' | 'current' | 'on'
>;

/** Launches, invites, the leave guard; the planned world extras are optional. */
export type MpLike = Pick<
  HubMpApi,
  'onLaunch' | 'onJoinInfo' | 'setBusy' | 'setJoinInfo' | 'inviteLink' | 'revokeInviteLink'
> &
  PlannedMpExtras;

/** Hub relay rooms; `list` is the public rooms waiting in their lobby (Play now joins one). */
export type RoomsLike = Pick<HubRoomsApi, 'create' | 'join' | 'reclaim' | 'list'>;

/**
 * Friends, player cards, chat modes, and the hub's Play online sheet (`openPlayOnline`,
 * realtime feature 4: a no-op on older runtimes, and optional here so a fake may leave it out).
 */
export type SocialLike = Pick<
  HubSocialApi,
  'openInvite' | 'openNotify' | 'openPlayer' | 'chatMode' | 'on' | 'friends'
> &
  Partial<Pick<HubSocialApi, 'openPlayOnline'>>;

/** Everything the kit uses from the hub client. */
export type HubLike = {
  readonly slug: string | null;
  readonly isOffline: boolean;
  readonly overlay: OverlayLike;
  readonly input: InputLike;
  readonly menu: MenuLike;
  readonly daily: DailyLike;
  readonly resume: ResumeLike;
  readonly race: RaceLike;
  readonly mp: MpLike;
  readonly rooms: RoomsLike;
  readonly presence: Pick<HubPresenceApi, 'set' | 'clear'>;
  readonly social: SocialLike;
  readonly notify: Pick<HubNotifyApi, 'setQuiet'>;
  /** "Your games": daily challenges in progress, the saved game, online games. */
  readonly saved: SavedLike;
  /** Online games, run by the hub from the game's rules. */
  readonly turns: TurnsLike;
  /** Players' avatars and the designer. */
  readonly avatar: AvatarLike;
  me: Hub['me'];
  /** Your user id, or null while nobody is signed in (synchronous; follows sign-in and the new-guest account). */
  userId: Hub['userId'];
  /** Typed as plain JSON (the kit validates it) instead of the client's generic. */
  getSave(slot: string): Promise<{ save: Save | null }>;
  putSave: Hub['putSave'];
  deleteSave: Hub['deleteSave'];
  submitScore: Hub['submitScore'];
  incrStat: Hub['incrStat'];
  maxStat: Hub['maxStat'];
  onStatus: Hub['onStatus'];
};
