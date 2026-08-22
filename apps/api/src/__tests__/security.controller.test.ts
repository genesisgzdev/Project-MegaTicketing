import { beforeEach, describe, expect, it, vi } from 'vitest';

const duplicate = vi.hoisted(() => vi.fn());
vi.mock('../redis', () => ({ default: { duplicate } }));

import { SecurityController } from '../controllers/security.controller';

describe('SecurityController WebSocket subscriptions', () => {
  beforeEach(() => duplicate.mockReset());

  function socketFixture() {
    const handlers: Record<string, (value?: unknown) => unknown> = {};
    const socket = {
      on: vi.fn((event: string, handler: (value?: unknown) => unknown) => { handlers[event] = handler; }),
      send: vi.fn(),
    };
    const app = { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
    return { handlers, socket, app };
  }

  it('replaces the previous Redis reader when a new stream is selected', async () => {
    const clients = [0, 1].map(() => ({
      xread: vi.fn().mockRejectedValue(new Error('Connection is closed')),
      quit: vi.fn().mockResolvedValue('OK'),
    }));
    duplicate.mockImplementation(() => clients.shift());
    const fixture = socketFixture();
    new SecurityController(fixture.app as never).handleConnection({ socket: fixture.socket as never });

    await fixture.handlers.message?.(Buffer.from(JSON.stringify({
      type: 'SUBSCRIBE_STREAM', eventId: '11111111-1111-4111-8111-111111111111',
    })));
    await fixture.handlers.message?.(Buffer.from(JSON.stringify({
      type: 'SUBSCRIBE_STREAM', eventId: '22222222-2222-4222-8222-222222222222',
    })));

    expect(duplicate).toHaveBeenCalledTimes(2);
    expect(clients).toHaveLength(0);
  });

  it('does not open Redis for an invalid event identifier', async () => {
    const fixture = socketFixture();
    new SecurityController(fixture.app as never).handleConnection({ socket: fixture.socket as never });

    await fixture.handlers.message?.(Buffer.from(JSON.stringify({
      type: 'SUBSCRIBE_STREAM', eventId: 'not-an-event-id',
    })));

    expect(duplicate).not.toHaveBeenCalled();
  });
});
