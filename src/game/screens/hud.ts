/**
 * The HUD over play (DOM, in the kit's play screen). (GAME: yours to edit.)
 *
 * Update text only when it changes: this runs every frame.
 */
import type { HudHooks } from '../../kit/boot/index.ts';
import { h } from '../../kit/ui/dom.ts';
import { timeLeft } from '../rules.ts';
import type { Profile, Run } from '../state.ts';
import { HUD } from '../strings.ts';

let coins: HTMLElement | null = null;
let time: HTMLElement | null = null;

/** TODO(game): what your HUD shows. */
export const hud: HudHooks<Profile, Run> = {
  mount(_ctx, el) {
    coins = h('span', { 'data-testid': 'hud-coins' });
    time = h('span', { 'data-testid': 'hud-time' });
    el.append(coins, time);
  },
  update(_ctx, run) {
    const c = HUD.coins(run.score, run.target);
    if (coins && coins.textContent !== c) coins.textContent = c;
    const left = timeLeft(run);
    const tx = left === null ? '' : HUD.time(left);
    if (time && time.textContent !== tx) time.textContent = tx;
  },
};
