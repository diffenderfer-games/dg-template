/**
 * kit/boot: `window.__game` for the stub game and every game built on defineGame.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/test-hook.md
 */
import { driversAllowed } from '../core/env.ts';
import { isJson, type JsonObject } from '../core/json.ts';
import { installTestHook, type GameHookDrivers, type GameTestHook } from '../test-hook/index.ts';
import type { OnlineFlow } from './online-flow.ts';
import { toast } from '../ui/toast.ts';
import type { Session } from './session.ts';
import type { GameContext, GameDefinition } from './types.ts';

/** The online drivers (rooms by code, start). */
function onlineDrivers(flow: OnlineFlow): GameHookDrivers['online'] {
  return {
    host: () => void flow.hostRoom(),
    join: (code, spectate = false) => void flow.joinRoom(code, spectate),
    start: () => flow.match.start(),
    room: () => flow.currentRoom(),
    seats: () => flow.match.room?.info.seats.length ?? 0,
    view: () => flow.match.view,
  };
}

/** The kit's version (kit.json `kitVersion`). */
export const KIT_VERSION = '1.2';

/** Install the hook for a defineGame game. */
export function installGameHook<P extends JsonObject, R extends JsonObject>(o: {
  game: GameDefinition<P, R>;
  ctx: GameContext<P, R>;
  session: Session<P, R>;
  slug: string;
  drivers?: boolean;
  audio?: { telemetry(): JsonObject };
  online?: OnlineFlow | null;
}): GameTestHook {
  const { game, session, ctx } = o;
  return installTestHook(
    {
      slug: o.slug,
      kit: KIT_VERSION,
      screen: () => session.screen,
      paused: () => session.paused,
      mode: () => session.mode,
      snap: () => game.snap?.(session.run) ?? {},
      ready: () => document.body.dataset.ready === '1',
      audio: () => o.audio?.telemetry() ?? {},
    },
    () => ({
      newGame: () => void session.newGame(),
      pause: () => session.pause(),
      resume: () => session.resume(),
      toTitle: () => session.toTitle(),
      solveNow: () => {
        if (session.run !== null) game.solve?.(session.run);
      },
      loseNow: () => session.finish('lost'),
      setState: (state) => {
        if (isJson(state) && game.run.validate(state)) {
          session.run = state;
        }
      },
      autoplay: (on) => {
        session.autoplay = on;
      },
      toast: (text) => void toast(text),
      extra: game.testHook?.(ctx) ?? {},
      ...(o.online ? { online: onlineDrivers(o.online) } : {}),
    }),
    { allowDrivers: o.drivers ?? driversAllowed() },
  );
}
