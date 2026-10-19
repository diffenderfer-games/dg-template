// KIT suite (games with game.turns): online games the hub runs on a real hub, on the kit's screen. A link game:
// Ann makes it, Bob takes the seat from the link, Ann starts; moves arrive live; Bob's quick-chat phrase (the
// game's own, game.turns.quickChat) reaches Ann; Bob closes his page and Ann sees "Waiting for Bob…", then
// "Let the computer play for Bob" once handOverAt comes, and the computer plays his seat to the end.
// Also: a game opened from the title's Continue row (Your games). Skipped for a game without game.turns.
// Asks the game, never assumes: a player may move several times in a row (a pick, then a guess), so
// each player moves until the turn passes; a long game (four rounds of a game show) may take a while.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { field } from '../../../src/kit/core/json.ts';
import { e2e, env, ready, ROOT, SLUG, until, waitScreen, type Player } from '../_kit.ts';

const block = field(field(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')), 'game'), 'turns');
const quick = field(block, 'quickChat');
const phrase = Array.isArray(quick) && typeof quick[0] === 'string' ? quick[0] : null;
const skip = block === undefined ? 'this game declares no game.turns (docs/kit/turns.md)' : false;

// The hand-over after 1.5 s instead of 2 minutes (test mode already zeroes the presence grace and delays).
const e = skip ? env() : env({ env: { HUB_LIMITS_JSON: JSON.stringify({ turnHandOverAfterMs: 1500 }) } });

type Shown = { phase: string; kind: string; seq: number; status: string };

/** The status line says this, or this plus the kit's " · you may move now" (a game with moves out of turn: mayAct). */
const says = (status: string, text: string): boolean => status === text || status.startsWith(`${text} · `);

/** The turns screen as the player sees it (its data attributes and status line). */
const shown = (p: Player): Promise<Shown> =>
  p.page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.kit-turns');
    return {
      phase: el?.dataset.phase ?? '',
      kind: el?.dataset.kind ?? '',
      seq: Number(el?.dataset.seq ?? -1),
      status: document.querySelector('[data-testid="turn-status"]')?.textContent ?? '',
    };
  });

/** Wait for the screen to match. */
const see = (p: Player, what: string, ok: (s: Shown) => boolean, timeout = 20_000): Promise<Shown> =>
  until(
    async () => {
      const s = await shown(p);
      return ok(s) ? s : null;
    },
    `${p.name}: ${what}`,
    timeout,
  );

/**
 * Make a move when the board allows it (a live event may redraw it at any moment): the game's
 * `turns.testMove`, through `__game.turnsMove()` (the test contract, docs/kit/testing.md).
 */
const move = (p: Player): Promise<boolean> =>
  until(() => p.page.evaluate(() => window.__game?.turnsMove?.() === true), `${p.name} makes a move`);

/** Move until the turn passes (or the game ends): some games let a player move several times in a row. */
async function moveWhileMine(p: Player, most = 40): Promise<void> {
  for (let i = 0; i < most; i++) {
    const s = await shown(p);
    if (s.kind !== 'mine' || s.phase === 'ended') return;
    await move(p);
    await see(p, 'the move lands', (n) => n.seq > s.seq || n.phase === 'ended');
  }
  throw new Error(`${p.name} still has the turn after ${most} moves`);
}

e2e(
  'turns: a link game in two browsers: live moves, quick-chat, "Waiting for…", the hand-over, the end',
  e,
  async (t) => {
    const ann = await t.newPlayer(undefined, `/${SLUG}/`);
    await ready(ann);
    await ann.tid('turns-new');
    await ann.tid('turns-link');
    await waitScreen(ann, 'turns');
    const link = await until(
      () => ann.page.evaluate(() => document.querySelector('[data-testid="turn-link"]')?.textContent ?? ''),
      'the invite link',
    );
    assert.match(link, /hub_turn_link=/);

    const bob = await t.newPlayer(undefined, link.replace(/^https?:\/\/[^/]+/, ''));
    await ready(bob);
    await waitScreen(bob, 'turns');
    await until(
      () =>
        ann.page.evaluate(
          () => document.querySelectorAll('[data-testid="turn-seats"] [data-status="joined"]').length === 2,
        ),
      "Bob's seat on Ann's page",
    );
    await ann.tid('turns-start');
    await see(ann, 'her turn', (s) => s.kind === 'mine');
    await see(bob, `"${ann.name} is playing"`, (s) => says(s.status, `${ann.name} is playing`));

    await moveWhileMine(ann);
    await see(bob, "Ann's moves, live", (s) => s.seq >= 1 && s.kind === 'mine');

    if (phrase !== null) {
      await bob.tid(`quick-g:${SLUG}:0`);
      await until(
        () =>
          ann.page.evaluate(
            (w) => document.querySelector('[data-testid="chat-lines"]')?.textContent?.includes(w) === true,
            phrase,
          ),
        "Bob's phrase on Ann's page",
      );
    }

    await bob.page.close(); // his only page: he isn't connected any more
    await see(ann, `"Waiting for ${bob.name}…"`, (s) => says(s.status, `Waiting for ${bob.name}…`));
    await ann.find('[data-testid="turns-hand-over"]', `Let the computer play for ${bob.name}`, { timeout: 20_000 });
    await ann.tid('turns-hand-over');
    await see(ann, 'the computer moved for Bob', (s) => s.seq >= 2 && (s.kind === 'mine' || s.phase === 'ended'));

    for (let i = 0; i < 400; i++) {
      const s = await shown(ann);
      if (s.phase === 'ended') break;
      if (s.kind === 'mine') await move(ann);
      await see(ann, 'the game goes on', (n) => n.phase === 'ended' || n.seq > s.seq);
    }
    const end = await see(ann, 'the end', (s) => s.phase === 'ended');
    assert.ok(end.kind === 'won' || end.kind === 'lost', JSON.stringify(end));
    await ann.find('[data-testid="turns-rematch"]');
  },
  { skip, timeout: 600_000 },
);

e2e(
  "turns: the title's Continue row opens an online game on the kit's screen (Your games)",
  e,
  async (t) => {
    const a = await t.newPlayer(undefined, `/${SLUG}/`);
    await ready(a);
    await a.tid('turns-new');
    await a.tid('turns-computer');
    await see(a, 'my turn against the computer', (s) => s.kind === 'mine');
    await a.tid('turns-back');
    await waitScreen(a, 'title');
    await a.goto(`/${SLUG}/`);
    await ready(a);
    await a.click('[data-testid^="continue"]', /^Continue.*Online with .+ · your turn/);
    await see(a, 'the game, still my turn', (s) => s.kind === 'mine' && s.seq === 0);
  },
  { skip, timeout: 60_000 },
);

e2e(
  'turns: Anyone joins the game that is waiting (listed in the chooser) instead of making a second one',
  e,
  async (t) => {
    const ann = await t.newPlayer(undefined, `/${SLUG}/`);
    const bob = await t.newPlayer(undefined, `/${SLUG}/`);
    await Promise.all([ready(ann), ready(bob)]);
    await ann.tid('turns-new');
    await ann.tid('turns-anyone');
    await waitScreen(ann, 'turns');
    await see(ann, 'her game waits for a player', (s) => s.phase === 'lobby');

    await bob.tid('turns-new');
    await bob.find('[data-testid^="turns-open-"] .kit-open-name', `${ann.name} is waiting`);
    await bob.tid('turns-anyone');
    await waitScreen(bob, 'turns');
    // One game for both, started by itself once every seat is taken (autoStart).
    await see(ann, 'the game starts', (s) => s.phase === 'playing');
    await see(bob, 'the game starts', (s) => s.phase === 'playing');
    const names = (p: Player): Promise<string> =>
      p.page.evaluate(() => document.querySelector('[data-testid="turn-seats"]')?.textContent ?? '');
    assert.ok((await names(ann)).includes(bob.name), "Bob sits in Ann's game");
  },
  { skip, timeout: 180_000 },
);
