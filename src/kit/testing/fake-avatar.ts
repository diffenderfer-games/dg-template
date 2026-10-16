/**
 * kit/testing: players' avatars (`hub.avatar`, `hub.userId()`).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour from hub.md "Avatars" and the client (core/avatar/hub-avatar.ts):
 * `from(seat)` reads the look a payload carries (no request); a payload with
 * no look falls back to the id's default; `''` is a hidden player (the
 * silhouette); `change` fires when a look the page can see changes, yours
 * with your user id. Codes are `AV1` plus a readable name, not real looks
 * (`look` is null), and `load()` registers nothing unless a test asks
 * (`renderer`), so unit tests never need the art.
 */
import type {
  AvatarChange,
  AvatarModule,
  AvatarRef,
  CarriesLook,
  DesignerResult,
  OpenDesignerOptions,
} from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type { AvatarLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';

/** A fake ref: `AV1<name>`, or the silhouette for `''`. */
export function fakeAvatarRef(name: string, isDefault = false): AvatarRef {
  return { code: name === '' ? '' : `AV1${name}`, look: null, isDefault, hidden: name === '' };
}

/** The fake `hub.avatar`. */
export class FakeAvatar implements AvatarLike {
  /** What `load()` gives back; a test can pass the real renderer module. */
  renderer: Pick<AvatarModule, 'defineAvatarElement'>;
  private mineCode: string | null = null;
  private readonly events = new Emitter<{ change: AvatarChange }>();
  private readonly log: CallLog;
  private readonly userId: () => number | null;

  constructor(log: CallLog, userId: () => number | null) {
    this.log = log;
    this.userId = userId;
    this.renderer = { defineAvatarElement: () => this.log.record('avatar.define') };
  }

  mine(): Promise<AvatarRef> {
    return Promise.resolve(this.mineSync() ?? fakeAvatarRef('you', true));
  }

  mineSync(): AvatarRef | null {
    const id = this.userId();
    return id === null ? null : fakeAvatarRef(this.mineCode ?? `me-${id}`);
  }

  of(userId: number): Promise<AvatarRef> {
    return Promise.resolve(
      userId === this.userId() ? fakeAvatarRef(this.mineCode ?? `me-${userId}`) : this.byId(userId),
    );
  }

  from(carrier: CarriesLook): AvatarRef {
    if (carrier.look !== undefined)
      return carrier.look === '' ? fakeAvatarRef('') : fakeAvatarRef(carrier.look.replace(/^AV1/, ''));
    const id = carrier.userId ?? carrier.id ?? carrier.uid;
    return id === undefined ? fakeAvatarRef('') : this.byId(id);
  }

  bot(seed: string | number): AvatarRef {
    return fakeAvatarRef(`bot-${seed}`, true);
  }

  on(_event: 'change', listener: (change: AvatarChange) => void): () => void {
    return this.events.on('change', listener);
  }

  openDesigner(options: OpenDesignerOptions = {}): Promise<DesignerResult> {
    this.log.record('avatar.openDesigner', options);
    return Promise.resolve({ saved: true });
  }

  load(): Promise<Pick<AvatarModule, 'defineAvatarElement'>> {
    this.log.record('avatar.load');
    return Promise.resolve(this.renderer);
  }

  // ---- drivers -------------------------------------------------------------

  /** A player changed their avatar (yours when `userId` is the signed-in player). */
  change(userId: number, name: string): void {
    if (userId === this.userId()) this.mineCode = name;
    this.events.emit('change', { userId, ref: fakeAvatarRef(name) });
  }

  private byId(userId: number): AvatarRef {
    return fakeAvatarRef(`user-${userId}`, true);
  }
}
