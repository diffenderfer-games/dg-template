/**
 * kit/core: warnings and dev-only failures.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 */
import { isDev, isTestHarness } from './env.ts';

/** A kit rule was broken (a profile write during a daily, a stat with text…). */
export class KitRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KitRuleError';
  }
}

/** Is the kit strict here (dev builds, unit tests, the e2e harness)? Strict = throw on rule breaks. */
export function isStrict(): boolean {
  return isDev() || isTestHarness() || (typeof import.meta.env === 'object' && import.meta.env.MODE === 'test');
}

/** Warn once per message (console.warn, prefixed). */
const warned = new Set<string>();
export function kitWarn(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[kit] ${message}`);
}

/** Break loudly in dev and tests, quietly (a warning) in production. */
export function ruleBroken(message: string): void {
  if (isStrict()) throw new KitRuleError(message);
  kitWarn(message);
}
