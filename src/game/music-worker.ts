/**
 * The music Worker: runs the game's MusicCore off the main thread (docs/kit/audio.md). (GAME: usually never changes.)
 */
import { hostWorker } from '../kit/audio/music.ts';
import { SongCore } from './music-core.ts';

type WorkerScope = {
  postMessage(msg: unknown, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<unknown>) => void) | null;
};

/** Inside a Worker, `self` has postMessage and onmessage (the DOM types call it a Window). */
function isWorkerScope(x: unknown): x is WorkerScope {
  return typeof x === 'object' && x !== null && 'postMessage' in x && 'onmessage' in x && !('document' in x);
}

const scope: unknown = self;
if (isWorkerScope(scope)) hostWorker((sampleRate) => new SongCore(sampleRate), scope);
