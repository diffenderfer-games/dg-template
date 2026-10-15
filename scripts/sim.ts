/**
 * `npm run sim`: play the rules many times headless and print the numbers. (GAME: yours to edit.)
 *
 *   npm run sim                    # 500 daily games
 *   npm run sim -- normal 2000 0.5  # mode, games, skill (0–1)
 */
import type { PlayMode } from '../src/kit/core/index.ts';
import { formatReport, seedRange, simulate } from '../src/kit/testing/sim.ts';
import { simSpec } from '../src/game/sim.ts';

const [modeArg = 'daily', countArg = '500', skillArg = '0.8'] = process.argv.slice(2);
const MODES: readonly PlayMode[] = ['normal', 'daily', 'race', 'online'];
const mode = MODES.find((m) => m === modeArg) ?? 'daily';
console.log(`${mode}, skill ${skillArg}`);
console.log(formatReport(simulate(simSpec(mode, Number(skillArg)), seedRange(Number(countArg)))));
