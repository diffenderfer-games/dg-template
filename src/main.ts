/**
 * The entry point. (GAME: it usually never changes.)
 *
 * `defineGame` registers every hub handler synchronously, before any await
 * (launches, the daily, pause), then boots the game. Never add a top-level
 * `await` here: it deadlocks Pixi 8's renderer chunks in the bundled build.
 */
import { hub } from '@diffenderfer-games/hub';
import { defineGame } from './kit/boot/index.ts';
import { game } from './game/game.ts';
import './game/theme.css';

defineGame(hub, game);
