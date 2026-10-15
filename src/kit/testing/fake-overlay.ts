/**
 * kit/testing: the overlay stack (pause when hub UI opens).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from the hub client (src/uistack/ui-stack.ts): one
 * open/close pair for nested UI, autoPause pausing at once when registered
 * while UI is open, canPause false while busy, `play` held while open.
 */
import type {
  AutoPauseOptions,
  OverlayEdge,
  OverlayEvent,
  OverlayListener,
  OverlayReason,
} from '@diffenderfer-games/hub';
import type { OverlayLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';

/** The fake overlay plus its drivers. */
export class FakeOverlay implements OverlayLike {
  private readonly entries: { reason: OverlayReason }[] = [];
  private readonly listeners: Record<OverlayEdge, Set<OverlayListener>> = { open: new Set(), close: new Set() };
  private pausable = true;
  private readonly log: CallLog;
  private readonly hooks: { onOpen(): void; onClose(): void; events: EventTarget };

  constructor(log: CallLog, hooks: { onOpen(): void; onClose(): void; events: EventTarget }) {
    this.log = log;
    this.hooks = hooks;
  }

  get isOpen(): boolean {
    return this.entries.length > 0;
  }

  get canPause(): boolean {
    return this.pausable;
  }

  get depth(): number {
    return this.entries.length;
  }

  /** Open hub UI (the menu, a chat…); returns its close. Nested opens make one open/close pair. */
  push(reason: OverlayReason = 'menu'): () => void {
    const entry = { reason };
    this.entries.push(entry);
    if (this.entries.length === 1) {
      this.hooks.onOpen();
      this.emit('open', { reason, canPause: this.pausable });
    }
    let popped = false;
    return () => {
      if (popped) return;
      popped = true;
      const i = this.entries.indexOf(entry);
      if (i < 0) return;
      this.entries.splice(i, 1);
      if (this.entries.length === 0) {
        this.emit('close', { reason, canPause: this.pausable });
        this.hooks.onClose();
      }
    };
  }

  on(edge: OverlayEdge, listener: OverlayListener): () => void {
    this.listeners[edge].add(listener);
    return () => {
      this.listeners[edge].delete(listener);
    };
  }

  autoPause(options: AutoPauseOptions): () => void {
    this.log.record('overlay.autoPause', { resumeOnClose: options.resumeOnClose === true });
    let pausedByUs = false;
    const onOpen = (e: OverlayEvent): void => {
      if (!e.canPause) return;
      pausedByUs = true;
      options.pause();
    };
    const onClose = (): void => {
      if (pausedByUs && options.resumeOnClose === true) options.resume?.();
      pausedByUs = false;
    };
    const stopOpen = this.on('open', onOpen);
    const stopClose = this.on('close', onClose);
    const first = this.entries[0];
    if (first) onOpen({ reason: first.reason, canPause: this.pausable });
    return () => {
      stopOpen();
      stopClose();
    };
  }

  setCanPause(canPause: boolean): void {
    this.pausable = canPause;
  }

  /** How many listeners an edge has (the "autoPause exactly once" rule). */
  listenerCount(edge: OverlayEdge): number {
    return this.listeners[edge].size;
  }

  private emit(edge: OverlayEdge, event: OverlayEvent): void {
    this.log.record(`overlay.${edge}`, event);
    for (const l of [...this.listeners[edge]]) l(event);
    this.hooks.events.dispatchEvent(new CustomEvent(`hub:overlay-${edge}`, { detail: event }));
  }
}
