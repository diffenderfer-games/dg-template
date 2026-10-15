import { describe, expect, it } from 'vitest';
import {
  boolField,
  cloneJson,
  field,
  isJson,
  isJsonObject,
  jsonBytes,
  numField,
  parseJson,
  strField,
} from '../../../src/kit/core/index.ts';

describe('json guards', () => {
  it('accepts JSON and rejects everything else', () => {
    expect(isJson({ a: [1, 'x', null, { b: false }] })).toBe(true);
    expect(isJson(undefined)).toBe(false);
    expect(isJson(Number.NaN)).toBe(false);
    expect(isJson({ f: () => 1 })).toBe(false);
    expect(isJson(new Date())).toBe(false);
    expect(isJsonObject([])).toBe(false);
    expect(isJsonObject({})).toBe(true);
  });

  it('parses text safely and clones deeply', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('nope')).toBeUndefined();
    const o = { a: [1] };
    const c = cloneJson(o);
    c.a.push(2);
    expect(o.a).toEqual([1]);
    expect(jsonBytes({ a: 'é' })).toBe(10);
  });

  it('reads untrusted fields with defaults', () => {
    const x: unknown = { n: 3, s: 'hi', b: true, bad: Number.NaN };
    expect(numField(x, 'n')).toBe(3);
    expect(numField(x, 'bad', -1)).toBe(-1);
    expect(strField(x, 'n', 'd')).toBe('d');
    expect(boolField(x, 'b')).toBe(true);
    expect(field(null, 'a')).toBeUndefined();
    expect(field({ toString: 1 }, 'hasOwnProperty')).toBeUndefined();
  });
});
