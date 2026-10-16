/**
 * kit/turns: who is there and whose move it is, in the hub's words (pure).
 * Source: dg-template src/kit/turns/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md § "The screen"
 *
 * multiplayer.md §16.3 "Who is there": each joined seat has `connected`
 * (absent = unknown). A due player is "Waiting for Ann…" only when
 * `connected === false`; otherwise (here, or unknown) "Ann is playing". The
 * hand-over ("Let the computer play for Ann") is the client's own
 * `canLetComputerPlay()`, asked again on each `turn` event and when
 * `summary.handOverAt` comes (`nextCheckIn`): no polling. Words never say
 * "turn game".
 */
import type { TurnSummary } from '@diffenderfer-games/hub';
import type { TurnGameLike } from '../core/hub-like.ts';
import { t } from '../core/strings.ts';

/** One seat of a summary. */
export type TurnSeat = TurnSummary['seats'][number];

/** The game's state as the screen shows it. */
export type TurnPhaseKind = 'lobby' | 'mine' | 'theirs' | 'won' | 'lost' | 'draw';

/** The status line: its kind and its words. */
export type TurnStatus = { kind: TurnPhaseKind; text: string };

/** The other players who must move now. */
export function dueOthers(summary: TurnSummary, mySeat: number | null): TurnSeat[] {
  return summary.seats.filter((s) => summary.toAct.includes(s.seat) && s.seat !== mySeat);
}

/** "Waiting for Ann…" (she isn't connected) or "Ann is playing" (here, or unknown). */
export function seatLine(seat: TurnSeat): string {
  return seat.connected === false ? t('waitingFor', { name: seat.name }) : t('isPlaying', { name: seat.name });
}

/** The status line for a game. */
export function turnStatus(game: Pick<TurnGameLike, 'summary' | 'mySeat' | 'outcome' | 'mayActNow'>): TurnStatus {
  const { summary, mySeat } = game;
  if (summary.phase === 'lobby')
    return { kind: 'lobby', text: summary.isMine ? t('turnsLobbyMine') : t('turnsLobbyGuest') };
  if (summary.phase === 'ended') {
    const winners = game.outcome?.winners ?? [];
    if (winners.length === 0) return { kind: 'draw', text: t('turnsDraw') };
    return mySeat !== null && winners.includes(mySeat)
      ? { kind: 'won', text: t('won') }
      : { kind: 'lost', text: t('lost') };
  }
  if (summary.isMyTurn) return { kind: 'mine', text: t('yourTurn') };
  const due = dueOthers(summary, mySeat);
  const text = due.map(seatLine).join(' · ');
  return { kind: 'theirs', text: game.mayActNow ? `${text} · ${t('youMayMove')}` : text };
}

/** Whom "Let the computer play for …" names: the due players who aren't connected (else every due one). */
export function handOverNames(summary: TurnSummary, mySeat: number | null): string {
  const due = dueOthers(summary, mySeat).filter((s) => s.status === 'joined');
  const away = due.filter((s) => s.connected !== true);
  return (away.length > 0 ? away : due).map((s) => s.name).join(', ');
}

/** When to ask `canLetComputerPlay()` again (ms from `now`), or null: `handOverAt` or the deadline, whichever comes first. */
export function nextCheckIn(summary: TurnSummary, now: number): number | null {
  const times = [summary.handOverAt, summary.deadline].filter((at): at is number => typeof at === 'number' && at > now);
  return times.length === 0 ? null : Math.min(...times) - now;
}
