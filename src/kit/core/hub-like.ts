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
 */
import type {
  DailySystem,
  GamePayload,
  ResumeLoadOptions,
  Save,
  HubMpApi,
  HubNotifyApi,
  HubPresenceApi,
  HubRaceApi,
  HubResume,
  HubRoomsApi,
  HubSocialApi,
  InputSystem,
  UiStack,
  Hub,
} from '@diffenderfer-games/hub';
import type {
  PlannedAvatarApi,
  PlannedDailyExtras,
  PlannedMpExtras,
  PlannedSavedApi,
  PlannedTurnsApi,
} from './planned.ts';

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
>;

/** Show/hide the hub's menu button. */
export type MenuLike = Pick<Hub['menu'], 'setVisible' | 'visible'>;

/** Daily challenges; the planned saved-games extras are optional until the hub ships them. */
export type DailyLike = Pick<DailySystem, 'active' | 'define' | 'complete' | 'cancel' | 'status' | 'startAndPlay'> &
  PlannedDailyExtras;

/**
 * The run slot behind the home page's Resume card. `load` is typed as
 * returning plain JSON (the kit validates it) instead of the client's generic.
 */
export type ResumeLike = Pick<HubResume, 'requested' | 'blockedBy' | 'save' | 'flush' | 'clear'> & {
  load(options?: ResumeLoadOptions): Promise<GamePayload | null>;
};

/** Races (multiplayer.md §14). */
export type RaceLike = Pick<
  HubRaceApi,
  'define' | 'create' | 'browse' | 'openHistory' | 'status' | 'finish' | 'lose' | 'leave' | 'current' | 'on'
>;

/** Launches, invites, the leave guard; the planned world extras are optional. */
export type MpLike = Pick<HubMpApi, 'onLaunch' | 'onJoinInfo' | 'setBusy' | 'inviteLink' | 'revokeInviteLink'> &
  PlannedMpExtras;

/** Hub relay rooms. */
export type RoomsLike = Pick<HubRoomsApi, 'create' | 'join' | 'reclaim'>;

/** Friends, player cards, chat modes. */
export type SocialLike = Pick<HubSocialApi, 'openInvite' | 'openNotify' | 'openPlayer' | 'chatMode' | 'on'>;

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
  me: Hub['me'];
  /** Typed as plain JSON (the kit validates it) instead of the client's generic. */
  getSave(slot: string): Promise<{ save: Save | null }>;
  putSave: Hub['putSave'];
  deleteSave: Hub['deleteSave'];
  submitScore: Hub['submitScore'];
  incrStat: Hub['incrStat'];
  maxStat: Hub['maxStat'];
  onStatus: Hub['onStatus'];
  /** Planned (saved-games phases 0–1): "Your games" and saved instances. Absent until the hub ships it. */
  readonly saved?: PlannedSavedApi;
  /** Planned (saved-games phase 3): server-run turn games. */
  readonly turns?: PlannedTurnsApi;
  /** Planned (avatars phases 0–2): the player's look, the designer. */
  readonly avatar?: PlannedAvatarApi;
};
