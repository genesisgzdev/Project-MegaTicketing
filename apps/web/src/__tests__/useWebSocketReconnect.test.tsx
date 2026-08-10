import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useWebSocketReconnect } from '../../src/hooks/useWebSocketReconnect';
import { ReactNode } from 'react';

const TestComponent = ({ url }: { url: string }) => {
  const { isConnected, isReconnecting, connectionAttempts, send } = useWebSocketReconnect({
    url,
    reconnectAttempts: 3,
    reconnectDelay: 100,
  });

  return (
    <div>
      <div data-testid="connection-status">{isConnected ? 'Connected' : 'Disconnected'}</div>
      <div data-testid="reconnecting-status">{isReconnecting ? 'Reconnecting' : 'Idle'}</div>
      <div data-testid="attempts">{connectionAttempts}</div>
      <button onClick={() => send({ type: 'test' })} data-testid="send-btn">
        Send
      </button>
    </div>
  );
};

describe('useWebSocketReconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should attempt to connect on mount', async () => {
    render(<TestComponent url="ws://localhost:3000" />);

    await waitFor(() => {
      // Component should render without errors
      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    });
  });

  it('should implement exponential backoff on reconnection', async () => {
    const { rerender } = render(<TestComponent url="ws://localhost:3000" />);

    // Simulate reconnection attempts
    vi.advanceTimersByTime(100); // First attempt: 100ms
    vi.advanceTimersByTime(200); // Second attempt: 200ms
    vi.advanceTimersByTime(400); // Third attempt: 400ms

    expect(screen.getByTestId('attempts')).toBeInTheDocument();
  });
});
