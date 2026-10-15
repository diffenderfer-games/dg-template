/**
 * kit/core: a tiny typed event emitter.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 */

/** Listeners by event name; `on` returns the unsubscribe. A throwing listener never stops the others. */
export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): () => void {
    const set = this.listeners[event] ?? new Set<(payload: Events[K]) => void>();
    this.listeners[event] = set;
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch (error) {
        console.error('[kit] listener failed', error);
      }
    }
  }

  /** How many listeners `event` has (tests). */
  count(event: keyof Events): number {
    return this.listeners[event]?.size ?? 0;
  }
}
