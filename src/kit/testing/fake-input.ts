/**
 * kit/testing: the input system.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from the hub client (src/input/input-system.ts and
 * src/uistack/play-suspension.ts): groups switch by name; while hub UI is
 * open `play` is held, and the last enable/disable made meanwhile is applied
 * on close.
 */
import type { InputConfig, InputEvents, InputSource, NavTarget, Vector } from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type { InputLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';

type Insets = { top?: number; right?: number; bottom?: number; left?: number };

/** The fake input system plus drivers to set what the player holds. */
export class FakeInput implements InputLike {
  config: InputConfig | null = null;
  nav: { targets: () => NavTarget[]; back?: () => void } | null = null;
  insets: Insets = {};
  touchDevice = false;
  private readonly enabled = new Set<string>();
  private readonly events = new Emitter<{ [K in keyof InputEvents]: InputEvents[K] }>();
  private readonly held = new Set<string>();
  private readonly edges = new Set<string>();
  private readonly vectors = new Map<string, Vector>();
  private suspendedPlay: boolean | null = null;
  private currentSource: InputSource = 'keyboard';
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  define(config: InputConfig): void {
    this.log.record('input.define', Object.keys(config.groups));
    this.config = config;
    for (const [name, group] of Object.entries(config.groups)) if (group.enabled === true) this.enabled.add(name);
  }

  enable(group: string): void {
    this.log.record('input.enable', group);
    if (group === 'play' && this.suspendedPlay !== null) this.suspendedPlay = true;
    else this.enabled.add(group);
  }

  disable(group: string): void {
    this.log.record('input.disable', group);
    if (group === 'play' && this.suspendedPlay !== null) this.suspendedPlay = false;
    else this.enabled.delete(group);
  }

  isEnabled(group: string): boolean {
    return this.enabled.has(group);
  }

  value(name: string): number {
    return this.held.has(name) ? 1 : 0;
  }

  vector(name: string): Vector {
    return this.vectors.get(name) ?? { x: 0, y: 0, mag: 0 };
  }

  down(name: string): boolean {
    return this.edges.has(name);
  }

  pressed(name: string): boolean {
    return this.held.has(name);
  }

  get source(): InputSource {
    return this.currentSource;
  }

  on<K extends keyof InputEvents>(event: K, listener: (payload: InputEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  autoNavigate(selector: string | (() => NavTarget[]), options?: { back?: () => void }): void {
    this.log.record('input.autoNavigate');
    const targets =
      typeof selector === 'string'
        ? (): NavTarget[] => [...document.querySelectorAll<HTMLElement>(selector)]
        : selector;
    this.nav = options?.back ? { targets, back: options.back } : { targets };
  }

  clearAutoNavigate(): void {
    this.nav = null;
  }

  setInsets(insets: Insets): void {
    this.log.record('input.setInsets', insets);
    this.insets = insets;
  }

  // ---- drivers -------------------------------------------------------------

  /** Hold a stick or axis pair (`move`). */
  setVector(name: string, v: { x: number; y: number }): void {
    this.vectors.set(name, { x: v.x, y: v.y, mag: Math.min(1, Math.hypot(v.x, v.y)) });
  }

  /** Press `name` for one frame (`down` is true until `endFrame`). */
  tap(name: string): void {
    this.edges.add(name);
    this.held.add(name);
  }

  /** The frame ended: edges clear, taps release. */
  endFrame(): void {
    for (const e of this.edges) this.held.delete(e);
    this.edges.clear();
  }

  /** The player switched devices. */
  switchSource(source: InputSource): void {
    this.currentSource = source;
    this.events.emit('sourcechange', source);
  }

  /** The back button (gamepad B / Escape) while menus are navigable. */
  pressBack(): void {
    this.nav?.back?.();
  }

  /** Hub UI opened: hold `play` (the overlay calls it). */
  suspendPlay(): void {
    if (this.suspendedPlay !== null) return;
    this.suspendedPlay = this.enabled.has('play');
    this.enabled.delete('play');
  }

  /** Hub UI closed: apply the last recorded enable/disable of `play`. */
  releasePlay(): void {
    if (this.suspendedPlay === null) return;
    if (this.suspendedPlay) this.enabled.add('play');
    this.suspendedPlay = null;
  }
}
