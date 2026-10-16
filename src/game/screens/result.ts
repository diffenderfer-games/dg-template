/**
 * The result screen's body. (GAME: yours to edit.)
 */
import type { GameContext, ResultInfo } from '../../kit/boot/index.ts';
import { h } from '../../kit/ui/dom.ts';
import { countUp } from '../../kit/ui/juice.ts';
import type { Profile, Run } from '../state.ts';
import { HUD } from '../strings.ts';

/** TODO(game): what the player sees when a game ends. */
export function result(ctx: GameContext<Profile, Run>, el: HTMLElement, info: ResultInfo<Run>): void {
  const body = el.querySelector('.kit-result-body');
  if (!body) return;
  const n = h('strong', { 'data-testid': 'result-score' }, '0');
  body.append(h('p', {}, 'Score: ', n));
  if (info.mode === 'normal') body.append(h('p', { 'data-testid': 'result-best' }, HUD.best(ctx.profile.data.best)));
  countUp(n, 0, info.run.score);
}
