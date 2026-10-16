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

let score: HTMLElement | null = null;
let time: HTMLElement | null = null;

/** TODO(game): what your HUD shows. */
export const hud: HudHooks<Profile, Run> = {
  mount(_ctx, el) {
    score = h('span', { 'data-testid': 'hud-score' });
    time = h('span', { 'data-testid': 'hud-time' });
    el.append(score, time);
  },
  update(_ctx, run) {
    const s = HUD.score(run.score, run.target);
    if (score && score.textContent !== s) score.textContent = s;
    const left = timeLeft(run);
    const tx = left === null ? '' : HUD.time(left);
    if (time && time.textContent !== tx) time.textContent = tx;
  },
};
