/**
 * kit/boot: the GameContext every hook receives.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/boot.md § "The context"
 */
import type { Activity } from '../core/activity.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import type { JsonObject } from '../core/json.ts';
import type { ControlsHandle } from '../input/controls.ts';
import { layoutRegion, onResize, raceHud, safeArea, type Insets } from '../layout/index.ts';
import type { ResumeSlot } from '../resume/index.ts';
import type { ProfileStore } from '../save/profile.ts';
import type { SettingsStore } from '../save/settings.ts';
import type { KitSettings } from '../settings-ui/index.ts';
import { toast } from '../ui/toast.ts';
import type { KitAudio } from '../audio/types.ts';
import type { Session } from './session.ts';
import type { GameContext, SessionApi } from './types.ts';

/** The pieces the context is made of. */
export type ContextParts<P extends JsonObject, R extends JsonObject> = {
  hub: HubLike;
  slug: string;
  clock: Clock;
  activity: Activity;
  profile: ProfileStore<P>;
  settings: SettingsStore<KitSettings>;
  resume: ResumeSlot<R>;
  controls: ControlsHandle;
  session: Session<P, R>;
  stage?: HTMLElement;
  uiRoot: HTMLElement;
  audio?: KitAudio;
  haptic?: (strong?: boolean) => void;
};

const SILENT: KitAudio = { play: () => undefined, startMusic: () => undefined, stopMusic: () => undefined };

/** The session as hooks see it. */
function sessionApi<P extends JsonObject, R extends JsonObject>(s: Session<P, R>): SessionApi<R> {
  return {
    get run() {
      return s.run;
    },
    get mode() {
      return s.mode;
    },
    get screen() {
      return s.screen;
    },
    get paused() {
      return s.paused;
    },
    newGame: () => s.newGame(),
    restart: () => s.restart(),
    toTitle: () => s.toTitle(),
    pause: () => s.pause(),
    resume: () => s.resume(),
    finish: (o) => s.finish(o),
  };
}

/** Build the context (once, by defineGame). */
export function buildContext<P extends JsonObject, R extends JsonObject>(p: ContextParts<P, R>): GameContext<P, R> {
  const stage =
    p.stage ??
    document.getElementById('app') ??
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
  let safe: Insets = safeArea();
  onResize(() => (safe = safeArea()), { clock: p.clock });
  return {
    hub: p.hub,
    slug: p.slug,
    clock: p.clock,
    activity: p.activity,
    profile: p.profile,
    settings: p.settings,
    resume: p.resume,
    controls: p.controls,
    session: sessionApi(p.session),
    audio: p.audio ?? SILENT,
    stage,
    uiRoot: p.uiRoot,
    size: () => ({ width: innerWidth, height: innerHeight }),
    region: () =>
      layoutRegion({
        width: innerWidth,
        height: innerHeight,
        safe,
        race: raceHud(),
        top: [...p.uiRoot.querySelectorAll('.kit-hud, .kit-corner')],
      }),
    onResize: (cb) => onResize(cb, { clock: p.clock }),
    toast: (text) => void toast(text),
    haptic: p.haptic ?? (() => undefined),
  };
}
