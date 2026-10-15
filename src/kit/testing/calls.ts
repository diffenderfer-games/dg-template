/**
 * kit/testing: the call log every fake writes to.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Test-only: imported by tests, never by the game, so the build tree-shakes it out.
 */

/** One recorded hub call (or game hook call): its name and its arguments. */
export type FakeCall = { readonly name: string; readonly args: readonly unknown[] };

/** An ordered log of calls. */
export class CallLog {
  readonly calls: FakeCall[] = [];

  record(name: string, ...args: unknown[]): void {
    this.calls.push({ name, args });
  }

  /** Every call named `name`, in order. */
  named(name: string): FakeCall[] {
    return this.calls.filter((c) => c.name === name);
  }

  /** How many calls were named `name`. */
  count(name: string): number {
    return this.named(name).length;
  }

  /** The names in order (handy for `toEqual([...])`). */
  names(): string[] {
    return this.calls.map((c) => c.name);
  }

  /** The last call named `name`, or undefined. */
  last(name: string): FakeCall | undefined {
    return this.named(name).at(-1);
  }

  clear(): void {
    this.calls.length = 0;
  }
}
