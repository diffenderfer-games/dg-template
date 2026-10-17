/**
 * kit/testing: launches, the leave guard, presence, quiet, friends and the menu button.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from multiplayer.md §6 and the hub client's forwarders:
 * launches that arrive before `onLaunch` is registered are buffered and
 * delivered when it is; `setBusy(true)` makes overlay events carry
 * `canPause: false`; presence, busy and quiet are remembered.
 */
import type {
  ChatMode,
  FriendEntry,
  InviteLink,
  JoinInfoEvent,
  Launch,
  OpenInviteOptions,
  PlayerRef,
  PresenceInput,
  SocialEvents,
} from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type { MenuLike, MpLike, SocialLike } from '../core/hub-like.ts';
import type { KitLaunch } from '../core/planned.ts';
import type { CallLog } from './calls.ts';

/** The fake `hub.mp`. */
export class FakeMp implements MpLike {
  busy = false;
  private readonly launchListeners = new Set<(launch: Launch) => void>();
  private readonly joinListeners = new Set<(e: JoinInfoEvent) => void>();
  private readonly buffered: Launch[] = [];
  private readonly log: CallLog;
  private readonly host: { readonly slug: string; readonly userId: number; setCanPause(v: boolean): void };
  quickMatch?: MpLike['quickMatch'];
  setRoster?: MpLike['setRoster'];

  constructor(
    log: CallLog,
    host: { readonly slug: string; readonly userId: number; setCanPause(v: boolean): void },
    planned: boolean,
  ) {
    this.log = log;
    this.host = host;
    if (planned) {
      this.quickMatch = (opts) => {
        this.log.record('mp.quickMatch', opts);
        return Promise.resolve();
      };
      this.setRoster = (ids) => this.log.record('mp.setRoster', [...ids]);
    }
  }

  onLaunch(listener: (launch: Launch) => void): () => void {
    this.log.record('mp.onLaunch');
    this.launchListeners.add(listener);
    for (const l of this.buffered.splice(0)) listener(l);
    return () => this.launchListeners.delete(listener);
  }

  onJoinInfo(listener: (e: JoinInfoEvent) => void): () => void {
    this.joinListeners.add(listener);
    return () => this.joinListeners.delete(listener);
  }

  setBusy(isBusy: boolean): void {
    this.log.record('mp.setBusy', isBusy);
    this.busy = isBusy;
    this.host.setCanPause(!isBusy);
  }

  setJoinInfo(partyId: string, info: Record<string, string>): Promise<void> {
    this.log.record('mp.setJoinInfo', partyId, info);
    return Promise.resolve();
  }

  inviteLink(): Promise<InviteLink> {
    this.log.record('mp.inviteLink');
    return Promise.resolve({
      token: 'link-token',
      url: `/${this.host.slug}/?hub_link=link-token`,
      game: this.host.slug,
      room: 'ABCDE',
      createdBy: this.host.userId,
      expiresAt: Date.UTC(2030, 0, 1),
    });
  }

  revokeInviteLink(token: string): Promise<void> {
    this.log.record('mp.revokeInviteLink', token);
    return Promise.resolve();
  }

  // ---- drivers -------------------------------------------------------------

  /** The hub brings the player in (buffered until `onLaunch` is registered). */
  launch(partial: Partial<KitLaunch> & Pick<Launch, 'kind'>): void {
    const launch: KitLaunch = { game: this.host.slug, ...partial };
    if (this.launchListeners.size === 0) {
      this.buffered.push(launch);
      return;
    }
    for (const l of this.launchListeners) l(launch);
  }

  /** The party leader published where to connect. */
  joinInfo(partyId: string, info: Record<string, string>): void {
    for (const l of this.joinListeners) l({ partyId, info });
  }
}

/** The fake `hub.social`. */
export class FakeSocial implements SocialLike {
  mode: ChatMode = 'on';
  private readonly events = new Emitter<{ [K in keyof SocialEvents]: SocialEvents[K] }>();
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  /** The player's friends (`friends()`). */
  friendList: FriendEntry[] = [];

  openInvite(options?: OpenInviteOptions): void {
    this.log.record('social.openInvite', options);
  }

  friends(): Promise<FriendEntry[]> {
    this.log.record('social.friends');
    return Promise.resolve(this.friendList.map((f) => ({ ...f })));
  }

  openNotify(options?: { game?: string }): void {
    this.log.record('social.openNotify', options);
  }

  openPlayer(ref: PlayerRef): void {
    this.log.record('social.openPlayer', ref);
  }

  chatMode(): ChatMode {
    return this.mode;
  }

  on<K extends keyof SocialEvents>(event: K, listener: (payload: SocialEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  /** A social event arrives (invite, party, friends, presence, counts). */
  emit<K extends keyof SocialEvents>(event: K, payload: SocialEvents[K]): void {
    this.events.emit(event, payload);
  }
}

/** The fake `hub.presence`. */
export class FakePresence {
  current: PresenceInput | null = null;
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  set(presence: PresenceInput): void {
    this.log.record('presence.set', presence);
    this.current = presence;
  }

  clear(): void {
    this.log.record('presence.clear');
    this.current = null;
  }
}

/** The fake `hub.notify`. */
export class FakeNotify {
  quiet = false;
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  setQuiet(isQuiet: boolean): void {
    this.log.record('notify.setQuiet', isQuiet);
    this.quiet = isQuiet;
  }
}

/** The fake `hub.menu` (the menu button). */
export class FakeMenu implements MenuLike {
  visible = true;
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  setVisible(isVisible: boolean): void {
    if (isVisible !== this.visible) this.log.record('menu.setVisible', isVisible);
    this.visible = isVisible;
  }
}
