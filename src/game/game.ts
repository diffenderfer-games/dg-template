/**
 * The game: its hooks (hooks.ts) drawn by the renderer in src/game/render/. (GAME: usually never changes.)
 */
import { createGame } from './hooks.ts';
import { createView } from './render/index.ts';

export const game = createGame(createView);
