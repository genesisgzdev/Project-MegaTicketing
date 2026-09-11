import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CyberArena from '../CyberArena';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('loads real API-shaped events and removes a selection when refreshed inventory sells it', async () => {
  let sold = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/events')
    ? { events: [{ id: 'event-a', title: 'Evening concert' }], nextCursor: null }
    : { seats: [{ id: 'seat-a', seatNumber: 'A1', price: 12.5, currency: 'eur', status: sold ? 'sold' : 'available' }] } })));
  const { unmount } = render(<CyberArena />);
  const seat = await screen.findByRole('button', { name: /A1, available/ });
  fireEvent.click(seat);
  expect(screen.getByText(/1 selected/)).toBeInTheDocument();
  sold = true;
  await waitFor(() => expect(screen.getByRole('button', { name: /A1, sold/ })).toBeDisabled(), { timeout: 6500 });
  expect(screen.getByText(/0 selected/)).toBeInTheDocument();
  unmount();
}, 8000);
