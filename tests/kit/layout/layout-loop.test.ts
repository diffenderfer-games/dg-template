// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { layoutRegion, letterbox, onResize } from '../../../src/kit/layout/index.ts';
import { clampDt, FixedLoop } from '../../../src/kit/loop/index.ts';
import { fakeClock } from '../../../src/kit/testing/index.ts';

describe('layout', () => {
  it('debounces resize, and measures twice on rotation (the viewport settles late)', () => {
    const clock = fakeClock(0);
    const sizes: number[] = [];
    const off = onResize((w) => sizes.push(w), { clock, debounceMs: 60 });
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    clock.advance(60);
    expect(sizes).toHaveLength(1);
    window.dispatchEvent(new Event('orientationchange'));
    clock.advance(400);
    expect(sizes).toHaveLength(3);
    off();
    window.dispatchEvent(new Event('resize'));
    clock.advance(100);
    expect(sizes).toHaveLength(3);
  });

  it('letterboxes a design into the viewport, centred', () => {
    expect(letterbox(800, 600, 400, 400)).toEqual({ scale: 1.5, x: 100, y: 0 });
  });

  it('the play region leaves room for the safe area, the race HUD, HUD bands and the menu button', () => {
    const hud = document.createElement('div');
    hud.getBoundingClientRect = () => ({
      top: 0,
      bottom: 50,
      left: 0,
      right: 0,
      width: 0,
      height: 50,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const r = layoutRegion({
      width: 400,
      height: 800,
      safe: { top: 20, right: 0, bottom: 30, left: 0 },
      race: { top: 40, bottom: 0 },
      top: [hud],
    });
    expect(r).toEqual({ x: 0, y: 60, width: 400, height: 710 });
    expect(layoutRegion({ width: 400, height: 800, menuButton: 70 }).y).toBe(70);
  });
});

describe('FixedLoop', () => {
  const make = (paused = () => false) => {
    const log: { steps: number; alphas: number[] } = { steps: 0, alphas: [] };
    const loop = new FixedLoop({ dt: 1 / 60, simulate: () => log.steps++, render: (a) => log.alphas.push(a), paused });
    return { loop, log };
  };

  it('runs N fixed steps for M ms, alpha in [0, 1)', () => {
    const { loop, log } = make();
    loop.frame(0);
    loop.frame(1000);
    expect(log.steps).toBe(15); // capped: 1000 ms is more than maxFrame (250 ms)
    for (let t = 1000; t <= 2000; t += 10) loop.frame(t);
    expect(log.steps).toBeGreaterThan(70);
    expect(log.alphas.every((a) => a >= 0 && a < 1)).toBe(true);
  });

  it('catch-up is capped by maxFrame (no spiral after a stall)', () => {
    const { loop, log } = make();
    loop.frame(0);
    loop.frame(60_000);
    expect(log.steps).toBe(15);
  });

  it('no steps while paused, but it keeps rendering', () => {
    const { loop, log } = make(() => true);
    loop.frame(0);
    loop.frame(500);
    expect(log.steps).toBe(0);
    expect(log.alphas).toHaveLength(2);
  });

  it('start/stop drive frames from the clock', () => {
    const clock = fakeClock(0);
    const log = { steps: 0 };
    const loop = new FixedLoop({ clock, simulate: () => log.steps++, render: () => undefined });
    loop.start();
    clock.advance(16 * 30);
    expect(loop.running).toBe(true);
    expect(log.steps).toBeGreaterThan(25);
    loop.stop();
    const before = log.steps;
    clock.advance(500);
    expect(log.steps).toBe(before);
  });

  it('clampDt clamps variable frames', () => {
    expect(clampDt(16)).toBeCloseTo(0.016);
    expect(clampDt(500)).toBe(0.05);
    expect(clampDt(-5)).toBe(0);
  });
});
