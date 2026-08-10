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
