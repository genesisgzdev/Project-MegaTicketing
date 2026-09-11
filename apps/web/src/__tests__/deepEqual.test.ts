import { describe, it, expect } from 'vitest';
import { isDeepEqual } from '../../src/utils/deepEqual';

describe('isDeepEqual', () => {
  it('should return true for identical primitives', () => {
    expect(isDeepEqual(1, 1)).toBe(true);
    expect(isDeepEqual('test', 'test')).toBe(true);
    expect(isDeepEqual(true, true)).toBe(true);
  });

  it('should return true for deeply equal objects', () => {
    const obj1 = { a: 1, b: { c: 2, d: [3, 4] } };
    const obj2 = { a: 1, b: { c: 2, d: [3, 4] } };
    expect(isDeepEqual(obj1, obj2)).toBe(true);
  });

  it('should return false for different objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };
    expect(isDeepEqual(obj1, obj2)).toBe(false);
  });

  it('should return false for different array lengths', () => {
    expect(isDeepEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  it('should handle null and undefined correctly', () => {
    expect(isDeepEqual(null, null)).toBe(true);
    expect(isDeepEqual(undefined, undefined)).toBe(true);
    expect(isDeepEqual(null, undefined)).toBe(false);
  });
});

it('distinguishes dates, array shapes and cyclic changes', () => {
  expect(isDeepEqual(new Date(0), new Date(1))).toBe(false);
  expect(isDeepEqual([], {})).toBe(false);
  expect(isDeepEqual(new Array(2), [])).toBe(false);
  const a: any = { value: 1 }; a.self = a;
  const b: any = { value: 1 }; b.self = b;
  expect(isDeepEqual(a, b)).toBe(true);
  b.value = 2;
  expect(isDeepEqual(a, b)).toBe(false);
});
