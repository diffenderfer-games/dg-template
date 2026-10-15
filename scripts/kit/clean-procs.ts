/**
 * `npm run clean:procs`: stop the browsers and servers this repo's scripts left running (never anyone else's).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Cleaning up"
 */
import { cleanUp } from './lib/procs.ts';

console.log(`stopped ${cleanUp()} process(es)`);
