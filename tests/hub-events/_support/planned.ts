/**
 * tests/hub-events: tests of planned hub APIs, written now and skipped until the hub phase ships.
 * Source: dg-template tests/hub-events/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Planned hub tests"
 *
 *   planned('savedGames01')('row 56: …', async () => { … });
 *
 * The test's name says what it waits on; flipping the phase's `shipped` in
 * kit/testing/phases.ts (a kit minor version) turns it on.
 */
import { it } from 'vitest';
import { HUB_PHASES, shipped, waitsOn, type HubPhase } from '../../../src/kit/testing/index.ts';

/** `it` when every phase shipped, else `it.skip`, with the phase in the name. */
export function planned(...phases: HubPhase[]): (name: string, fn: () => Promise<void> | void) => void {
  const ready = shipped(...phases);
  return (name, fn) => (ready ? it : it.skip)(`${name} [${ready ? 'turned on' : waitsOn(...phases)}]`, fn);
}

/** The phase labels (for docs and reports). */
export const PHASES = HUB_PHASES;
