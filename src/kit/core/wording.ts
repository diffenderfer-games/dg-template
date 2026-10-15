/**
 * kit/core: the player-facing wording check (kid-safe, hub wording).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md § "Strings"
 *
 * Used at runtime in dev on the labels a game returns (`progress()`), and by
 * `kit:check` on `game.changes`. The lint rule does the same for string literals.
 */

const KIND_WORDS = /\b(run|runs|turn game|turn games|instance|instances)\b/i;
const VIOLENT_WORDS = /\b(kill|killed|kills|shoot|shot|gun|guns|murder|blood|die|dies|dead)\b/i;

/** What's wrong with a player-facing text (empty when fine): kind words, violent words, too long. */
export function wordingProblems(text: string, maxLength = 60): string[] {
  const problems: string[] = [];
  const kind = KIND_WORDS.exec(text);
  if (kind) problems.push(`says "${kind[0]}" (players see "game" / "Continue")`);
  const violent = VIOLENT_WORDS.exec(text);
  if (violent) problems.push(`violent word "${violent[0]}"`);
  if (text.length > maxLength) problems.push(`longer than ${maxLength} characters`);
  return problems;
}
