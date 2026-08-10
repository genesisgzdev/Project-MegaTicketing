import { useEffect, useRef, useCallback } from 'react';

interface LocalStateSyncOptions {
  key: string;
  serializer?: (value: any) => string;
  deserializer?: (value: string) => any;
  debounceMs?: number;
}

export function useLocalStateSync<T>(
  state: T,
  options: LocalStateSyncOptions,
) {
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const serializer = options.serializer || JSON.stringify;
  const deserializer = options.deserializer || JSON.parse;
  const debounceMs = options.debounceMs || 500;

  // Sync state to localStorage with debouncing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(options.key, serializer(state));
      } catch (error) {
        console.error(`Failed to sync state to localStorage for key "${options.key}":`, error);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [state, options.key, serializer, debounceMs]);

  // Restore state from localStorage
  const restore = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(options.key);
      return stored ? deserializer(stored) : null;
    } catch (error) {
      console.error(`Failed to restore state from localStorage for key "${options.key}":`, error);
      return null;
    }
  }, [options.key, deserializer]);

  const clear = useCallback(() => {
    localStorage.removeItem(options.key);
  }, [options.key]);

  return { restore, clear };
}
