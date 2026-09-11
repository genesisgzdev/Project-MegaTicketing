import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CyberArena from '../CyberArena';

const seat = (id: string, status = 'available') => ({ id, seatNumber: id === 'seat-a' ? 'A1' : 'A2', price: 12.5, currency: 'eur', status });
const reply = (payload: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('removes a selection when refreshed inventory sells it', async () => {
  let sold = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => reply(url.endsWith('/events')
    ? { events: [{ id: 'event-a', title: 'Evening concert' }], nextCursor: null }
    : { seats: [seat('seat-a', sold ? 'sold' : 'available')] })));
  const { unmount } = render(<CyberArena />);
  fireEvent.click(await screen.findByRole('button', { name: /A1, Disponible/ }));
  expect(screen.getByText(/1 asiento elegido/)).toBeInTheDocument();
  sold = true;
  await waitFor(() => expect(screen.getByRole('button', { name: /A1, Vendido/ })).toBeDisabled(), { timeout: 6500 });
  expect(screen.getByText(/0 asientos elegidos/)).toBeInTheDocument();
  unmount();
}, 8000);

it('validates organizer access and reports each actual reservation outcome', async () => {
  const requests: RequestInit[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/events')) return reply({ events: [{ id: 'event-a', title: 'Concert' }] });
    if (url.endsWith('/seats')) return reply({ seats: [seat('seat-a'), seat('seat-b')] });
    if (url.endsWith('/session')) return reply({ userId: 'verified-user' });
    requests.push(options!);
    const body = JSON.parse(options!.body as string);
    return body.seatId === 'seat-a' ? reply({ data: { reserved: true, seatId: 'seat-a' } }, 201) : reply({ message: 'conflict' }, 409);
  }));
  render(<CyberArena />);
  fireEvent.click(await screen.findByRole('button', { name: /A1, Disponible/ }));
  fireEvent.click(screen.getByRole('button', { name: /A2, Disponible/ }));
  fireEvent.change(screen.getByLabelText('Acceso facilitado por el organizador'), { target: { value: 'organizer-access' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conectar acceso' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reservar selección' }));
  await screen.findByText(/Ese asiento ya no está disponible/);
  expect(screen.getByText(/Reserva temporal aceptada/)).toBeInTheDocument();
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(JSON.parse(request.body as string)).toMatchObject({ userId: 'verified-user', eventId: 'event-a' });
    expect(JSON.parse(request.body as string)).not.toHaveProperty('price');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer organizer-access', 'Idempotency-Key': expect.any(String) });
  }
  expect(screen.getByText(/1 asiento elegido/)).toBeInTheDocument();
});

it('reuses the request key when a response is lost and blocks duplicate clicks', async () => {
  const keys: string[] = [];
  let attempts = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/events')) return reply({ events: [{ id: 'event-a', title: 'Concert' }] });
    if (url.endsWith('/seats')) return reply({ seats: [seat('seat-a')] });
    if (url.endsWith('/session')) return reply({ userId: 'verified-user' });
    keys.push((options!.headers as Record<string, string>)['Idempotency-Key']);
    if (attempts++ === 0) throw Error('Connection interrupted');
    return reply({ data: { reserved: true, seatId: 'seat-a' } }, 201);
  }));
  render(<CyberArena />);
  fireEvent.click(await screen.findByRole('button', { name: /A1, Disponible/ }));
  fireEvent.change(screen.getByLabelText('Acceso facilitado por el organizador'), { target: { value: 'organizer-access' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conectar acceso' }));
  const reserve = await screen.findByRole('button', { name: 'Reservar selección' });
  fireEvent.click(reserve); fireEvent.click(reserve);
  await screen.findByText('Connection interrupted');
  expect(keys).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reservar selección' }));
  await screen.findByText(/Reserva temporal aceptada/);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

it('offers recovery when event pagination cycles instead of requesting forever', async () => {
  const fetcher = vi.fn(async () => reply({ events: [], nextCursor: 'same-cursor' }));
  vi.stubGlobal('fetch', fetcher);
  render(<CyberArena />);
  await screen.findByText(/No pudimos completar la lista/);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('does not let an invalid organizer access reserve seats', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/events')
    ? reply({ events: [{ id: 'event-a', title: 'Concert' }] })
    : url.endsWith('/session') ? reply({}, 401) : reply({ seats: [seat('seat-a')] })));
  render(<CyberArena />);
  fireEvent.click(await screen.findByRole('button', { name: /A1, Disponible/ }));
  fireEvent.change(screen.getByLabelText('Acceso facilitado por el organizador'), { target: { value: 'invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conectar acceso' }));
  await screen.findByText(/Ese acceso no se pudo validar/);
  expect(screen.queryByRole('button', { name: 'Reservar selección' })).not.toBeInTheDocument();
});
