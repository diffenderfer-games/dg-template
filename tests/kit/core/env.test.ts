// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { inFrame, isEmbedded } from '../../../src/kit/core/env.ts';
import { goFullscreen, lockPointer } from '../../../src/kit/layout/index.ts';

/** A same-origin iframe's window (the world's box is one). */
function frameWindow(): Window {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (win === null) throw new Error('no iframe window');
  return win;
}

describe('in a frame (the world\'s box, hub.md "Playing over the world")', () => {
  it('inFrame: a page in an iframe, not the top page', () => {
    expect(inFrame(window)).toBe(false);
    expect(inFrame(frameWindow())).toBe(true);
  });

  it('isEmbedded: in a frame and opened with ?hub_embed=1 (or the host noted it)', () => {
    expect(isEmbedded(window, '?hub_embed=1')).toBe(false);
    const win = frameWindow();
    expect(isEmbedded(win, '')).toBe(false);
    expect(isEmbedded(win, '?hub_embed=1')).toBe(true);
    Reflect.set(win, '__hubEmbed', 1);
    expect(isEmbedded(win, '')).toBe(true);
  });

  it('never asks for fullscreen or pointer lock inside a frame', async () => {
    const asked: string[] = [];
    const el = document.createElement('div');
    el.requestFullscreen = () => (asked.push('fullscreen'), Promise.resolve());
    el.requestPointerLock = () => (asked.push('lock'), Promise.resolve());
    const win = frameWindow();
    expect(await goFullscreen(el, win)).toBe(false);
    expect(await lockPointer(el, win)).toBe(false);
    expect(asked).toEqual([]);
    expect(await goFullscreen(el, window)).toBe(true);
    expect(await lockPointer(el, window)).toBe(true);
    expect(asked).toEqual(['fullscreen', 'lock']);
  });
});
