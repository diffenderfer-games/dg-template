/**
 * kit/server (optional, own-server games): static + SPA fallback, /healthz, the /ws upgrade, seats with grace.
 * Source: dg-template src/kit/server/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/server.md
 *
 * Node only (tsconfig.node.json). From bingo server/server.ts (hub-verified
 * tickets), 8ballpool server/server.ts and SpacePong gameManager.js (seat
 * grace). The WebSocket library is the game's choice: pass `onUpgrade`.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { extname, join, normalize, sep } from 'node:path';

/** The close code for a bad or missing ticket (the client shows "sign in again"). */
export const BAD_TICKET_CLOSE = 4401;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/** The port the catalog assigns (`PORT` or `GAME_PORT`), else `fallback`. */
export function portFromEnv(env: NodeJS.ProcessEnv = process.env, fallback = 0): number {
  const p = Number(env.PORT ?? env.GAME_PORT ?? '');
  return Number.isInteger(p) && p > 0 ? p : fallback;
}

/** Serve `dist`: files, then index.html for any other GET (SPA), /healthz, and the WebSocket upgrade. */
export function createGameServer(o: {
  dist: string;
  healthPath?: string;
  wsPath?: string;
  onUpgrade?(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  /** Extra routes (return true when handled). */
  route?(req: IncomingMessage, res: ServerResponse): boolean;
}): { server: Server; listen(port?: number): Promise<number> } {
  const health = o.healthPath ?? '/healthz';
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === health) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (o.route?.(req, res) === true) return;
    const file = resolveFile(o.dist, url.pathname);
    if (file === null) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (o.onUpgrade && path.endsWith(o.wsPath ?? '/ws')) o.onUpgrade(req, socket, head);
    else socket.destroy();
  });
  return {
    server,
    listen: (port = portFromEnv()) =>
      new Promise((resolve) => {
        server.listen(port, () => {
          const addr = server.address();
          resolve(typeof addr === 'object' && addr !== null ? addr.port : port);
        });
      }),
  };
}

/** The file for a URL path inside `dist` (never outside it), or index.html for app routes, or null. */
export function resolveFile(dist: string, pathname: string): string | null {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const full = join(dist, clean);
  if (!full.startsWith(normalize(dist + sep)) && full !== normalize(dist)) return null;
  if (existsSync(full) && statSync(full).isFile()) return full;
  if (extname(clean) !== '') return null; // a missing asset is a 404, not the app
  const index = join(dist, 'index.html');
  return existsSync(index) ? index : null;
}

/** A seat's state. */
export type SeatStatus = 'here' | 'away' | 'gone';

/**
 * Seats held for a dropped player's grace (multiplayer.md §8: 3 minutes while
 * playing): the computer plays an away seat; the same user (by token) takes
 * it back; after the grace it is gone for good.
 */
export class SeatTable<T> {
  private readonly seats = new Map<number, { token: string; data: T; status: SeatStatus; until: number }>();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  /** Seat a player (or re-seat them). */
  sit(seat: number, token: string, data: T): void {
    this.seats.set(seat, { token, data, status: 'here', until: Infinity });
  }

  /** The player dropped: hold the seat for `graceMs`. */
  hold(seat: number, graceMs: number): void {
    const s = this.seats.get(seat);
    if (s && s.status === 'here') Object.assign(s, { status: 'away', until: this.now() + graceMs });
  }

  /** The same player came back (by token): their seat, or null. */
  rejoin(token: string): number | null {
    this.expire();
    for (const [seat, s] of this.seats) {
      if (s.token === token && s.status !== 'gone') {
        Object.assign(s, { status: 'here', until: Infinity });
        return seat;
      }
    }
    return null;
  }

  /** Free seats whose grace ran out; returns them. */
  expire(): number[] {
    const out: number[] = [];
    for (const [seat, s] of this.seats) {
      if (s.status === 'away' && this.now() >= s.until) {
        s.status = 'gone';
        out.push(seat);
      }
    }
    return out;
  }

  status(seat: number): SeatStatus | null {
    return this.seats.get(seat)?.status ?? null;
  }

  /** Seats the computer plays (away or gone). */
  computerSeats(): number[] {
    this.expire();
    return [...this.seats].filter(([, s]) => s.status !== 'here').map(([seat]) => seat);
  }

  /** Is any human still here (never end a match while one is)? */
  anyoneHere(): boolean {
    return [...this.seats.values()].some((s) => s.status === 'here');
  }
}

/** Check a ticket with the hub (the game-server SDK's verifier); null when bad. Fresh ticket every connect. */
export async function verifyPlayer<V>(
  verify: (ticket: string) => Promise<V | null>,
  ticket: string | null,
): Promise<V | null> {
  if (ticket === null || ticket === '') return null;
  try {
    return await verify(ticket);
  } catch {
    return null;
  }
}
