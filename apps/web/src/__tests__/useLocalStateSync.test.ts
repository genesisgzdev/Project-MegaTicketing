import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStateSync } from '../../src/hooks/useLocalStateSync';

describe('useLocalStateSync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('should sync state to localStorage with debouncing', () => {
    const state = { user: 'john', age: 30 };
    const { result } = renderHook(() =>
      useLocalStateSync(state, {
        key: 'user_state',
        debounceMs: 500,
      }),
    );

    vi.advanceTimersByTime(500);

    const stored = localStorage.getItem('user_state');
    expect(stored).toBe(JSON.stringify(state));
  });

  it('should restore state from localStorage', () => {
    const initialState = { user: 'jane', age: 25 };
    localStorage.setItem('user_state', JSON.stringify(initialState));

    const { result } = renderHook(() =>
      useLocalStateSync(initialState, {
        key: 'user_state',
      }),
    );

    const restored = result.current.restore();
    expect(restored).toEqual(initialState);
  });

  it('should clear localStorage entry', () => {
    localStorage.setItem('user_state', JSON.stringify({ user: 'test' }));

    const { result } = renderHook(() =>
      useLocalStateSync({}, {
        key: 'user_state',
      }),
    );

    act(() => {
      result.current.clear();
    });

    expect(localStorage.getItem('user_state')).toBeNull();
  });
});
