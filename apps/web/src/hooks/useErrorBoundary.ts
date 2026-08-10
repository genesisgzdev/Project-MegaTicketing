import { useCallback } from 'react';

export interface ErrorBoundaryConfig {
  onError?: (error: Error, info: { componentStack: string }) => void;
  onReset?: () => void;
}

export function useErrorBoundary(config: ErrorBoundaryConfig = {}) {
  const resetError = useCallback(() => {
    config.onReset?.();
  }, [config]);

  return {
    resetError,
  };
}

export class ErrorBoundaryClass extends Error {
  constructor(
    message: string,
    public componentStack?: string,
  ) {
    super(message);
    this.name = 'ErrorBoundary';
  }
}
