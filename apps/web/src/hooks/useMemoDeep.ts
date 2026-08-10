import { useRef, useEffect, DependencyList } from 'react';
import { isDeepEqual } from '../utils/deepEqual';

export function useMemoDeep<T>(
  factory: () => T,
  deps: DependencyList,
): T {
  const ref = useRef<{ deps: DependencyList; value: T } | null>(null);

  if (!ref.current || !isDeepEqual(deps, ref.current.deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}
